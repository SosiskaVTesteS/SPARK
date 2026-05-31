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

  // ── OpenAI Moderation API ───────────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error('[moderate-content] OpenAI error', res.status, errText);
      return json({ allowed: true }); // fail open
    }

    const data   = await res.json();
    const result = data?.results?.[0];
    if (!result) return json({ allowed: true });

    if (result.flagged) {
      const categories: Record<string, boolean> = result.categories || {};
      const flaggedCats = Object.keys(categories).filter((k) => categories[k]);
      const reason = flaggedCats.join(', ') || 'content_policy_violation';
      console.log('[moderate-content] flagged:', reason);
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
