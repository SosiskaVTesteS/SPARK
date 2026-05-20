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

// ── Email content ────────────────────────────────────────────────────────────

function emailSubject(lang: 'ru' | 'en'): string {
  return lang === 'en'
    ? 'SPARK account deletion confirmation code'
    : 'Код подтверждения удаления аккаунта SPARK';
}

function emailHtml(code: string, lang: 'ru' | 'en'): string {
  if (lang === 'en') {
    return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d1118;color:#e8e8f0;padding:32px;border-radius:12px;border:1px solid #2a2a3a;">
      <h2 style="color:#e25c5c;letter-spacing:2px;margin:0 0 16px">⚠️ CRITICAL ACTION</h2>
      <p style="color:#a0a0b0;margin:0 0 12px">You requested <strong style="color:#e8e8f0">account deletion</strong> on SPARK.</p>
      <p style="color:#a0a0b0;margin:0 0 20px">Your confirmation code:</p>
      <div style="background:#1a1a2e;border:1px solid #e25c5c;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#e25c5c;">${code}</span>
      </div>
      <p style="color:#626270;font-size:13px;margin:0">Valid for 15 minutes. If this wasn't you — change your password immediately.</p>
    </div>`;
  }
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d1118;color:#e8e8f0;padding:32px;border-radius:12px;border:1px solid #2a2a3a;">
    <h2 style="color:#e25c5c;letter-spacing:2px;margin:0 0 16px">⚠️ КРИТИЧЕСКОЕ ДЕЙСТВИЕ</h2>
    <p style="color:#a0a0b0;margin:0 0 12px">Вы запросили <strong style="color:#e8e8f0">удаление аккаунта</strong> на платформе SPARK.</p>
    <p style="color:#a0a0b0;margin:0 0 20px">Ваш код подтверждения:</p>
    <div style="background:#1a1a2e;border:1px solid #e25c5c;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#e25c5c;">${code}</span>
    </div>
    <p style="color:#626270;font-size:13px;margin:0">Код действителен 15 минут. Если это были не вы — срочно смените пароль.</p>
  </div>`;
}

// ── Email providers (fetch-only, no nodemailer) ──────────────────────────────

function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.trim().match(/^(.+?)\s*<([^>]+)>$/);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: 'SPARK', email: raw.trim() };
}

async function sendViaGmailScript(to: string, code: string, lang: 'ru' | 'en'): Promise<boolean> {
  const url = Deno.env.get('GMAIL_SCRIPT_URL');
  if (!url) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject: emailSubject(lang), html: emailHtml(code, lang) }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error('gmail_script_failed');
    const data = await res.json();
    return Boolean(data?.ok);
  } catch (e) { clearTimeout(t); throw e; }
}

async function sendViaResend(to: string, code: string, lang: 'ru' | 'en'): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return false;
  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'SPARK <onboarding@resend.dev>';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: emailSubject(lang), html: emailHtml(code, lang) }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) { console.error('[delete-code] Resend', res.status); throw new Error('email_failed'); }
    return true;
  } catch (e) { clearTimeout(t); throw e; }
}

async function sendViaBrevo(to: string, code: string, lang: 'ru' | 'en'): Promise<boolean> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) return false;
  const from = parseFrom(Deno.env.get('BREVO_FROM_EMAIL') || Deno.env.get('SMTP_FROM') || 'SPARK <noreply@example.com>');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: from, to: [{ email: to }], subject: emailSubject(lang), htmlContent: emailHtml(code, lang) }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) { console.error('[delete-code] Brevo', res.status); throw new Error('email_failed'); }
    return true;
  } catch (e) { clearTimeout(t); throw e; }
}

async function sendEmail(to: string, code: string, lang: 'ru' | 'en'): Promise<void> {
  const hasGmail  = Boolean(Deno.env.get('GMAIL_SCRIPT_URL'));
  const hasResend = Boolean(Deno.env.get('RESEND_API_KEY'));
  const hasBrevo  = Boolean(Deno.env.get('BREVO_API_KEY'));
  if (!hasGmail && !hasResend && !hasBrevo) {
    console.warn('[delete-code] No email provider configured');
    return;
  }
  if (hasGmail)  { try { if (await sendViaGmailScript(to, code, lang)) return; } catch (e) { console.error('[delete-code] Gmail Script failed', e); } }
  if (hasResend) { try { if (await sendViaResend(to, code, lang)) return; } catch (e) { console.error('[delete-code] Resend failed', e); } }
  if (hasBrevo)  { try { if (await sendViaBrevo(to, code, lang)) return; } catch (e) { console.error('[delete-code] Brevo failed', e); } }
}

// ── Module-level clients — warm invocation reuse ─────────────────────────────

const _url  = Deno.env.get('SUPABASE_URL') ?? '';
const _svc  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const _anon = Deno.env.get('SUPABASE_ANON_KEY') || _svc;

const admin = (_url && _svc)
  ? createClient(_url, _svc,  { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const userClient = (_url && _anon)
  ? createClient(_url, _anon, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!admin || !userClient) return json({ error: 'Server configuration error' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing auth header' }, 401);

  let payload: { password?: string; lang?: string } = {};
  try { payload = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }

  const password = payload.password;
  if (!password) return json({ error: 'Password is required' }, 400);

  const lang: 'ru' | 'en' = payload.lang === 'en' ? 'en' : 'ru';
  const token = authHeader.replace('Bearer ', '');

  // 1 — verify JWT, get email
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user?.email) {
    return json({ error: 'Invalid or expired session. Please sign in again.' }, 401);
  }
  const email = userData.user.email;

  // 2 — parallel: verify password + cooldown check
  const [verifyRes, cooldownRes] = await Promise.allSettled([
    userClient.auth.signInWithPassword({ email, password }),
    admin.from('pending_deletions').select('created_at').eq('email', email).maybeSingle(),
  ]);

  if (verifyRes.status === 'rejected' || verifyRes.value?.error) {
    return json({ error: 'Incorrect password' }, 400);
  }

  const cooldownRow = cooldownRes.status === 'fulfilled' ? cooldownRes.value?.data : null;
  if (cooldownRow?.created_at) {
    const elapsed = Date.now() - new Date(cooldownRow.created_at).getTime();
    if (elapsed < 30_000) {
      const wait = Math.ceil((30_000 - elapsed) / 1000);
      return json({ error: lang === 'en' ? `Wait ${wait}s before requesting again.` : `Подождите ещё ${wait} сек.` }, 429);
    }
  }

  // 3 — generate code + save
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: dbErr } = await admin.from('pending_deletions').upsert(
    { email, code, attempts: 0, expires_at: expiresAt, created_at: now },
    { onConflict: 'email' }
  );
  if (dbErr) {
    console.error('[delete-code] upsert error:', dbErr.message);
    return json({ error: 'Failed to create deletion request.' }, 500);
  }

  // 4 — send email in background, respond instantly
  const allowDev = Deno.env.get('ALLOW_DEV_REGISTRATION_CODES') === 'true';
  if (allowDev) {
    try { await sendEmail(email, code, lang); } catch (e) { console.error('[delete-code] dev send error:', e); }
    return json({ ok: true, message: 'Code created (dev)', dev_code: code });
  }

  (globalThis as any).EdgeRuntime.waitUntil(
    (async () => {
      try { await sendEmail(email, code, lang); } catch (e: any) { console.error('[delete-code] bg send error:', e?.message || e); }
    })()
  );

  return json({ ok: true, message: 'Confirmation code sent to your email' });
});
