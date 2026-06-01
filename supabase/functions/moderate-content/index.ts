import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Server-side link check (same pattern as frontend — defence in depth)
const LINK_PATTERN = /(https?:\/\/|www\.|t\.me\/)/i;

// Write to moderation_log (fire-and-forget, non-blocking)
function logDecision(
  admin: ReturnType<typeof createClient>,
  verdict: string,
  reason: string,
) {
  admin.from('moderation_log').insert({
    idea_id:    null,   // idea doesn't exist yet at this stage
    stage:      'openai_filter',
    verdict,
    reason,
  }).then(() => {}).catch((e: unknown) => {
    console.warn('[moderate-content] log write failed:', e);
  });
}

const SYSTEM_PROMPT = `You are a strict content moderation system for a social platform. Your task is to analyze the provided text and determine if it violates the platform's content policies.

PROHIBITED CONTENT (return allowed: false):
- Pornography, explicit sexual content, erotica, or sexual solicitation
- Extremism, terrorism, calls for violence, or promotion of illegal organizations
- Content related to illegal weapons, drugs, or other controlled substances
- Spam, mass advertising, or promotion of external Telegram channels/bots/services
- Hate speech targeting race, ethnicity, religion, gender, or sexual orientation
- Content that facilitates illegal activity

ALLOWED CONTENT (return allowed: true):
- Business ideas, startup concepts, and entrepreneurial discussions
- Technology, science, and educational content
- Social and political commentary (without incitement to violence)
- Creative writing, art, and entertainment ideas
- Any neutral, constructive, or productive content

Respond ONLY with a JSON object in this exact format:
{"allowed": boolean, "reason": "краткое описание причины на русском (1 sentence, or 'ok' if allowed)"}

Examples:
{"allowed": true, "reason": "ok"}
{"allowed": false, "reason": "Текст содержит явные сексуальные материалы"}
{"allowed": false, "reason": "Реклама стороннего Telegram-канала"}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const authHeader  = req.headers.get('Authorization') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ message: 'Server configuration error' }, 500);
  }

  // Verify caller is authenticated
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return json({ message: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ message: 'Unauthorized' }, 401);

  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAiKey) {
    console.error('[moderate-content] OPENAI_API_KEY not set');
    return json({ allowed: true }); // fail open
  }

  let payload: { text?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ message: 'Invalid request body' }, 400);
  }

  const text = (payload.text || '').trim();
  if (!text) return json({ allowed: true });

  // ── Server-side link block ──────────────────────────────────────────────
  if (LINK_PATTERN.test(text)) {
    console.log('[moderate-content] blocked: links detected');
    logDecision(admin, 'blocked', 'links_not_allowed');
    return json({ allowed: false, reason: 'links_not_allowed' });
  }

  // ── GPT-4o-mini moderation ──────────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error('[moderate-content] OpenAI error', res.status, errText);
      return json({ allowed: true }); // fail open
    }

    const data = await res.json();
    const raw  = data?.choices?.[0]?.message?.content || '';

    let verdict: { allowed: boolean; reason?: string };
    try {
      verdict = JSON.parse(raw);
    } catch {
      console.warn('[moderate-content] JSON parse failed:', raw);
      return json({ allowed: true }); // fail open on parse error
    }

    if (verdict.allowed === false) {
      const reason = verdict.reason || 'content_policy_violation';
      console.log('[moderate-content] blocked by GPT:', reason);
      logDecision(admin, 'blocked', reason);
      return json({ allowed: false, reason });
    }

    return json({ allowed: true });
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('[moderate-content] fetch error:', e);
    return json({ allowed: true }); // fail open
  }
});
