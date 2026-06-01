import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// Sentinel: marks a queue row as "claimed" during processing.
// Any row with processed_at = CLAIMING means it's in-flight.
// A cleanup cron can reset rows stuck in this state for >5 min.
const CLAIMING = '9999-12-31T23:59:59.999Z';

// Extract JSON from Gemini response — tolerates markdown code fences
function extractJson(raw: string): { verdict: string; reason: string } | null {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (
      (parsed.verdict === 'BAN' || parsed.verdict === 'ALLOW') &&
      typeof parsed.reason === 'string'
    ) {
      return { verdict: parsed.verdict, reason: parsed.reason };
    }
    return null;
  } catch {
    return null;
  }
}

function buildPrompt(title: string, description: string): string {
  const text = [title, description].filter(Boolean).join('\n\n');
  return (
    `На этот пост платформы SPARK поступили жалобы от пользователей.\n` +
    `Текст поста: ${text}\n\n` +
    `Внимательно проанализируй содержимое. Это реальный скам, мошенничество или нарушение правил?\n` +
    `Или это нормальный пост, на который просто пожаловались хейтеры?\n` +
    `Верни СТРОГО JSON без лишнего текста:\n` +
    `{"verdict": "BAN" | "ALLOW", "reason": "краткое объяснение на русском"}`
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey   = Deno.env.get('GEMINI_API_KEY');

  if (!supabaseUrl || !serviceKey) return json({ message: 'Server configuration error' }, 500);
  if (!geminiKey) {
    console.error('[cyber-judge] GEMINI_API_KEY not set');
    return json({ message: 'Gemini not configured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 1. Find oldest unprocessed item ────────────────────────────────────
  const { data: candidate, error: qErr } = await admin
    .from('moderation_queue')
    .select('id, idea_id')
    .is('processed_at', null)
    .order('queued_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (qErr) {
    console.error('[cyber-judge] queue fetch error:', qErr.message);
    return json({ message: 'Database error' }, 500);
  }
  if (!candidate) {
    return json({ ok: true, message: 'queue_empty' });
  }

  // ── 2. Atomically CLAIM the item (optimistic lock) ──────────────────────
  // Only updates if processed_at is still NULL — prevents parallel processing.
  const { data: claimed, error: claimErr } = await admin
    .from('moderation_queue')
    .update({ processed_at: CLAIMING })
    .eq('id', candidate.id)
    .is('processed_at', null)          // conditional: unclaimed only
    .select('id, idea_id')
    .maybeSingle();

  if (claimErr || !claimed) {
    // Another concurrent invocation claimed this item first — nothing to do
    return json({ ok: true, message: 'queue_empty_or_claimed' });
  }

  // Helper: release claim on failure so the item can be retried
  const releaseClaim = () =>
    admin.from('moderation_queue').update({ processed_at: null }).eq('id', claimed.id);

  // ── 3. Fetch idea text ──────────────────────────────────────────────────
  const { data: idea, error: iErr } = await admin
    .from('ideas')
    .select('id, title, description, author_id')
    .eq('id', claimed.idea_id)
    .maybeSingle();

  if (iErr || !idea) {
    // Idea was deleted while in queue — finalise without verdict
    await admin
      .from('moderation_queue')
      .update({ processed_at: new Date().toISOString(), ai_reasoning: 'idea_deleted' })
      .eq('id', claimed.id);
    return json({ ok: true, message: 'idea_deleted', idea_id: claimed.idea_id });
  }

  // ── 4. Call Gemini 1.5 Flash ────────────────────────────────────────────
  const prompt     = buildPrompt(idea.title || '', idea.description || '');
  const geminiUrl  =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 20000);

  let verdict: string;
  let reason: string;

  try {
    const gRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!gRes.ok) {
      const errText = await gRes.text();
      console.error('[cyber-judge] Gemini HTTP error', gRes.status, errText);
      await releaseClaim();
      return json({ message: 'Gemini API error', detail: gRes.status }, 502);
    }

    const gData   = await gRes.json();
    const rawText: string = gData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed  = extractJson(rawText);

    if (!parsed) {
      console.error('[cyber-judge] unparseable Gemini response:', rawText);
      await releaseClaim();
      return json({ message: 'Gemini response parse error', raw: rawText }, 502);
    }

    verdict = parsed.verdict;
    reason  = parsed.reason;
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('[cyber-judge] Gemini fetch error:', e);
    await releaseClaim();
    return json({ message: 'Gemini unreachable' }, 502);
  }

  // ── 5. Apply verdict ────────────────────────────────────────────────────
  const now = new Date().toISOString();

  if (verdict === 'BAN') {
    await admin.from('ideas').update({ status: 'banned' }).eq('id', idea.id);

    // Archive full text for manual appeal — survives even if idea is later deleted
    await admin.from('banned_posts').insert({
      idea_id:        idea.id,
      original_text:  [idea.title, idea.description].filter(Boolean).join('\n\n'),
      author_user_id: idea.author_id,
      banned_at:      now,
      ai_reasoning:   reason,
    });
  } else {
    // ALLOW → return to feed with immunity + reset report counter
    await admin.from('ideas').update({ status: 'immune', report_count: 0 }).eq('id', idea.id);
  }

  // ── 6. Finalise queue row ────────────────────────────────────────────────
  await admin
    .from('moderation_queue')
    .update({ processed_at: now, verdict, ai_reasoning: reason })
    .eq('id', claimed.id);

  // ── 7. Append to moderation_log ─────────────────────────────────────────
  await admin.from('moderation_log').insert({
    idea_id:    idea.id,
    stage:      'gemini_judge',
    verdict,
    reason,
    created_at: now,
  });

  console.log(`[cyber-judge] idea ${idea.id} → ${verdict}: ${reason}`);

  return json({ ok: true, idea_id: idea.id, verdict, reason });
});
