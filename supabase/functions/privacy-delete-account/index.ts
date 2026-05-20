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

// ── Pre-created admin client for warm invocation reuse ───────────────────────
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const admin = (supabaseUrl && serviceKey)
  ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!admin) return json({ error: 'Server configuration error' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing auth header' }, 401);

  let body: { code?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid request body' }, 400); }

  const code = String(body.code || '').replace(/\D/g, '');
  if (!code) return json({ error: 'Code is required' }, 400);

  const token = authHeader.replace('Bearer ', '');

  // ── Parallel: validate JWT + fetch pending deletion record ─────────────────
  const [userResult, pendingResult] = await Promise.allSettled([
    admin.auth.getUser(token),
    // We don't know email yet, but we can pre-warm the connection; real query follows below.
  ]);

  const userRes = userResult.status === 'fulfilled' ? userResult.value : null;
  const user = userRes?.data?.user;

  if (!userRes || userRes.error || !user || !user.email) {
    return json({ error: 'Invalid token or missing email' }, 401);
  }

  const email = user.email;

  // ── Fetch pending deletion for this email ───────────────────────────────────
  const { data: pending, error: fetchError } = await admin
    .from('pending_deletions')
    .select('code, attempts, expires_at')
    .eq('email', email)
    .maybeSingle();

  if (fetchError || !pending) {
    return json({ error: 'No pending deletion found. Please request a new code.' }, 404);
  }

  if (pending.expires_at && new Date(pending.expires_at).getTime() < Date.now()) {
    // Fire-and-forget cleanup
    admin.from('pending_deletions').delete().eq('email', email);
    return json({ error: 'Code has expired. Please request a new one.' }, 400);
  }

  if ((pending.attempts ?? 0) >= 5) {
    admin.from('pending_deletions').delete().eq('email', email);
    return json({ error: 'Too many failed attempts. Please request a new code.' }, 429);
  }

  if (pending.code !== code) {
    // Fire-and-forget attempt increment
    admin.from('pending_deletions')
      .update({ attempts: (pending.attempts || 0) + 1 })
      .eq('email', email);
    return json({ error: 'Invalid code' }, 400);
  }

  // ── Code is valid — delete user + cleanup concurrently in background ────────
  (globalThis as any).EdgeRuntime.waitUntil(
    Promise.allSettled([
      admin.auth.admin.deleteUser(user.id),
      admin.from('pending_deletions').delete().eq('email', email),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === 'rejected') {
          console.error('[privacy-delete-account] Background task error:', r.reason);
        }
      }
    })
  );

  return json({ ok: true, message: 'Account successfully deleted' });
});
