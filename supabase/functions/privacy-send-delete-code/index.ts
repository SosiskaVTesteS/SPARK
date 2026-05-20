import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import nodemailer from 'npm:nodemailer@6.9.10';

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

// ── Bilingual email templates ────────────────────────────────────────────────

function deleteEmailHtml(code: string, lang: 'ru' | 'en'): string {
  if (lang === 'en') {
    return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d1118;color:#e8e8f0;padding:32px;border-radius:12px;border:1px solid #2a2a3a;">
      <h2 style="color:#e25c5c;letter-spacing:2px;margin:0 0 16px">⚠️ CRITICAL ACTION</h2>
      <p style="color:#a0a0b0;margin:0 0 12px">You have requested <strong style="color:#e8e8f0">account deletion</strong> on the SPARK platform.</p>
      <p style="color:#a0a0b0;margin:0 0 20px">Your confirmation code:</p>
      <div style="background:#1a1a2e;border:1px solid #e25c5c;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#e25c5c;">${code}</span>
      </div>
      <p style="color:#626270;font-size:13px;margin:0">This code is valid for 15 minutes. If you did not request this — change your password in Privacy settings immediately.</p>
    </div>`;
  }
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d1118;color:#e8e8f0;padding:32px;border-radius:12px;border:1px solid #2a2a3a;">
      <h2 style="color:#e25c5c;letter-spacing:2px;margin:0 0 16px">⚠️ КРИТИЧЕСКОЕ ДЕЙСТВИЕ</h2>
      <p style="color:#a0a0b0;margin:0 0 12px">Вы запросили <strong style="color:#e8e8f0">удаление аккаунта</strong> на платформе SPARK.</p>
      <p style="color:#a0a0b0;margin:0 0 20px">Ваш код подтверждения:</p>
      <div style="background:#1a1a2e;border:1px solid #e25c5c;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#e25c5c;">${code}</span>
      </div>
      <p style="color:#626270;font-size:13px;margin:0">Код действителен 15 минут. Если это были не вы — срочно смените пароль в настройках приватности.</p>
    </div>`;
}

function deleteEmailSubject(lang: 'ru' | 'en'): string {
  return lang === 'en'
    ? 'SPARK account deletion confirmation code'
    : 'Код подтверждения удаления аккаунта SPARK';
}

// ── Email helpers ────────────────────────────────────────────────────────────

function parseFromAddress(raw: string): { name: string; email: string } {
  const match = raw.trim().match(/^(.+?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: 'SPARK', email: raw.trim() };
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
      body: JSON.stringify({ from, to: [to], subject: deleteEmailSubject(lang), html: deleteEmailHtml(code, lang) }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) { console.error('[send-delete-code] Resend error', res.status); throw new Error('email_delivery_failed'); }
    return true;
  } catch (e) { clearTimeout(t); throw e; }
}

async function sendViaBrevo(to: string, code: string, lang: 'ru' | 'en'): Promise<boolean> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) return false;
  const fromRaw = Deno.env.get('BREVO_FROM_EMAIL') || Deno.env.get('SMTP_FROM') || 'SPARK <noreply@example.com>';
  const from = parseFromAddress(fromRaw);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: from, to: [{ email: to }], subject: deleteEmailSubject(lang), htmlContent: deleteEmailHtml(code, lang) }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) { console.error('[send-delete-code] Brevo error', res.status); throw new Error('email_delivery_failed'); }
    return true;
  } catch (e) { clearTimeout(t); throw e; }
}

async function sendViaGmailScript(to: string, code: string, lang: 'ru' | 'en'): Promise<boolean> {
  const scriptUrl = Deno.env.get('GMAIL_SCRIPT_URL');
  if (!scriptUrl) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject: deleteEmailSubject(lang), html: deleteEmailHtml(code, lang) }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) { throw new Error('gmail_script_failed'); }
    const data = await res.json();
    return Boolean(data?.ok);
  } catch (e) { clearTimeout(t); throw e; }
}

function smtpConfigured(): boolean {
  return Boolean(Deno.env.get('SMTP_HOSTNAME') && Deno.env.get('SMTP_PORT') &&
    Deno.env.get('SMTP_USERNAME') && Deno.env.get('SMTP_PASSWORD') && Deno.env.get('SMTP_FROM'));
}

let cachedTransport: any = null;
function getSmtpTransport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    pool: true, maxConnections: 5, maxMessages: 100,
    host: Deno.env.get('SMTP_HOSTNAME')!,
    port: Number(Deno.env.get('SMTP_PORT')),
    secure: Deno.env.get('SMTP_SECURE') === 'true',
    auth: { user: Deno.env.get('SMTP_USERNAME')!, pass: Deno.env.get('SMTP_PASSWORD')! },
  });
  return cachedTransport;
}

async function sendViaSmtp(to: string, code: string, lang: 'ru' | 'en'): Promise<boolean> {
  if (!smtpConfigured()) return false;
  const transport = getSmtpTransport();
  await new Promise<void>((resolve, reject) =>
    transport.sendMail({ from: Deno.env.get('SMTP_FROM')!, to, subject: deleteEmailSubject(lang), html: deleteEmailHtml(code, lang) },
      (err: any) => err ? reject(err) : resolve())
  );
  return true;
}

async function sendDeleteCode(to: string, code: string, lang: 'ru' | 'en'): Promise<boolean> {
  const hasGmailScript = Boolean(Deno.env.get('GMAIL_SCRIPT_URL'));
  const hasSmtp = smtpConfigured();
  const hasResend = Boolean(Deno.env.get('RESEND_API_KEY'));
  const hasBrevo = Boolean(Deno.env.get('BREVO_API_KEY'));
  if (!hasResend && !hasBrevo && !hasSmtp && !hasGmailScript) {
    console.warn('[send-delete-code] No email provider configured');
    return false;
  }
  let lastErr: unknown = null;
  if (hasGmailScript) { try { if (await sendViaGmailScript(to, code, lang)) return true; } catch (e) { lastErr = e; } }
  if (hasSmtp)        { try { if (await sendViaSmtp(to, code, lang)) return true; } catch (e) { lastErr = e; } }
  if (hasResend)      { try { if (await sendViaResend(to, code, lang)) return true; } catch (e) { lastErr = e; } }
  if (hasBrevo)       { try { if (await sendViaBrevo(to, code, lang)) return true; } catch (e) { lastErr = e; } }
  if (lastErr) throw lastErr;
  return false;
}

// ── Module-level clients (reused across warm invocations) ────────────────────
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey;

const admin = (supabaseUrl && serviceKey)
  ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const userClient = (supabaseUrl && anonKey)
  ? createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!admin || !userClient) return json({ error: 'Server configuration error' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing auth header' }, 401);

  let payload: { password?: string; lang?: string } = {};
  try { payload = await req.json(); } catch { return json({ error: 'Invalid request payload' }, 400); }

  const password = payload.password;
  if (!password) return json({ error: 'Password is required' }, 400);

  const lang: 'ru' | 'en' = payload.lang === 'en' ? 'en' : 'ru';
  const token = authHeader.replace('Bearer ', '');

  // ── Step 1: Verify JWT — get user email ─────────────────────────────────────
  const getUserRes = await admin.auth.getUser(token);
  const user = getUserRes.data?.user;
  if (getUserRes.error || !user?.email) {
    return json({ error: 'Invalid token or missing email' }, 401);
  }
  const email = user.email;

  // ── Step 2: Parallel — verify password + check cooldown ────────────────────
  const [verifyResult, cooldownResult] = await Promise.allSettled([
    userClient.auth.signInWithPassword({ email, password }),
    admin.from('pending_deletions').select('created_at').eq('email', email).maybeSingle(),
  ]);

  // Password check
  const verifyRes = verifyResult.status === 'fulfilled' ? verifyResult.value : null;
  if (!verifyRes || verifyRes.error) {
    return json({ error: 'Incorrect password' }, 400);
  }

  // Cooldown check (30s between requests)
  const cooldownData = cooldownResult.status === 'fulfilled' ? cooldownResult.value?.data : null;
  if (cooldownData?.created_at) {
    const elapsed = Date.now() - new Date(cooldownData.created_at).getTime();
    if (elapsed < 30_000) {
      const waitSec = Math.ceil((30_000 - elapsed) / 1000);
      const msg = lang === 'en'
        ? `A code was already sent. Please wait ${waitSec}s.`
        : `Код уже был отправлен. Подождите ещё ${waitSec} сек.`;
      return json({ error: msg }, 429);
    }
  }

  // ── Step 3: Generate code + save to DB ─────────────────────────────────────
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { error: dbError } = await admin.from('pending_deletions').upsert(
    { email, code, attempts: 0, expires_at: expiresAt, created_at: now },
    { onConflict: 'email' }
  );
  if (dbError) {
    console.error('[send-delete-code] DB upsert error:', dbError.message);
    return json({ error: 'Failed to create deletion request: ' + dbError.message }, 500);
  }

  // ── Step 4: Send email in background — respond instantly ───────────────────
  const allowDev = Deno.env.get('ALLOW_DEV_REGISTRATION_CODES') === 'true';
  if (allowDev) {
    try { await sendDeleteCode(email, code, lang); } catch (e) { console.error('[dev] send error:', e); }
    return json({ ok: true, message: 'Code created (dev mode)', dev_code: code });
  }

  (globalThis as any).EdgeRuntime.waitUntil(
    sendDeleteCode(email, code, lang).catch((e: any) =>
      console.error('[send-delete-code] Background send error:', e?.message || e)
    )
  );

  return json({ ok: true, message: 'Confirmation code sent to your email' });
});
