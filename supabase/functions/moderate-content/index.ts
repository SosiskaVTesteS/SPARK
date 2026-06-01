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

const CF_WORKER_URL = Deno.env.get('CF_FILTER_URL') || 'https://spark-ai-filter.mtsoppe1.workers.dev';

// Write to moderation_log (fire-and-forget, non-blocking)
function logDecision(
  admin: ReturnType<typeof createClient>,
  verdict: string,
  reason: string,
) {
  admin.from('moderation_log').insert({
    idea_id: null,
    stage:   'cf_llama_filter',
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

  const filterToken = Deno.env.get('CF_FILTER_TOKEN');
  if (!filterToken) {
    console.error('[moderate-content] CF_FILTER_TOKEN not set');
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

  // ── AI moderation via Cloudflare Worker (bypasses Supabase IP rate limits) ──
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-filter-token': filterToken,
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error('[moderate-content] CF Worker error', res.status);
      return json({ allowed: true }); // fail open
    }

    const verdict = await res.json() as { allowed: boolean; reason?: string };

    if (verdict.allowed === false) {
      const reason = verdict.reason || 'content_policy_violation';
      console.log('[moderate-content] blocked by CF+Gemini:', reason);
      logDecision(admin, 'blocked', reason);
      return json({ allowed: false, reason });
    }

    return json({ allowed: true });
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('[moderate-content] CF Worker fetch error:', e);
    return json({ allowed: true }); // fail open
  }
});
