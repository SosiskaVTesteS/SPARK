import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import bcrypt from 'npm:bcryptjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function sha256(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function pepper(): string {
  return Deno.env.get('REGISTRATION_PEPPER') || 'spark';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!supabaseUrl || !serviceKey || !dbUrl) {
    return json({ message: 'Server configuration error' }, 500);
  }

  let payload: { email?: string; code?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ message: 'Invalid request' }, 400);
  }

  const email = normalizeEmail(payload.email || '');
  const code = String(payload.code || '').trim();
  const password = payload.password || '';

  if (!email || !/^\d{6}$/.test(code) || password.length < 8) {
    return json({ message: 'Invalid verification code' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: pending, error: fetchError } = await admin
    .from('pending_registrations')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (fetchError || !pending) {
    return json({ message: 'Invalid verification code' }, 400);
  }

  if (new Date(pending.expires_at).getTime() < Date.now()) {
    await admin.from('pending_registrations').delete().eq('email', email);
    return json({ message: 'Verification code expired' }, 400);
  }

  if (pending.attempts >= 5) {
    return json({ message: 'Too many attempts. Request a new code.' }, 429);
  }

  const codeHash = await sha256(code + ':' + email);
  if (codeHash !== pending.code_hash) {
    await admin
      .from('pending_registrations')
      .update({ attempts: (pending.attempts || 0) + 1 })
      .eq('email', email);
    return json({ message: 'Invalid verification code' }, 400);
  }

  const passwordHash = await sha256(password + ':' + pepper());
  if (passwordHash !== pending.password_hash) {
    return json({ message: 'Invalid verification code' }, 400);
  }

  // Connect to DB directly
  const client = new Client(dbUrl);
  await client.connect();

  let userId: string | null = null;
  let sessionTokens: { access_token: string; refresh_token: string } | null = null;

  try {
    // 1. Check if user already exists
    const checkUser = await client.queryObject<{ id: string }>(
      'select id from auth.users where email = $1',
      [email]
    );

    if (checkUser.rows.length > 0) {
      userId = checkUser.rows[0].id;
    } else {
      // 2. Insert user directly to completely bypass slow/hanging GoTrue welcome emails
      userId = crypto.randomUUID();
      const identityId = crypto.randomUUID();
      const salt = bcrypt.genSaltSync(10);
      const encryptedPassword = bcrypt.hashSync(password, salt);
      const now = new Date().toISOString();
      const appMetadata = JSON.stringify({ provider: 'email', providers: ['email'] });
      const userMetadata = JSON.stringify({ username: pending.username });
      const identityData = JSON.stringify({
        sub: userId,
        email: email,
        email_verified: true,
        phone_verified: false
      });

      const tx = client.createTransaction("insert_user_tx");
      await tx.begin();
      try {
        await tx.queryObject(`
          insert into auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, confirmed_at, created_at, updated_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin, is_anonymous, is_sso_user
          ) values (
            '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3,
            $4, $4, $4, $4,
            $5, $6, false, false, false
          )
        `, [userId, email, encryptedPassword, now, appMetadata, userMetadata]);

        await tx.queryObject(`
          insert into auth.identities (
            id, user_id, identity_data, provider, provider_id, email, created_at, updated_at
          ) values (
            $1, $2, $3, 'email', $2, $4, $5, $5
          )
        `, [identityId, userId, identityData, email, now]);

        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    }
  } catch (err: any) {
    console.error('[register-verify] DB error:', err.message || err);
    await client.end();
    return json({ message: 'Could not complete registration' }, 500);
  }

  await client.end();

  // --- Parallel: profiles upsert + pending cleanup ---
  const profilePromise = admin.from('profiles').upsert({
    id: userId,
    username: pending.username,
    spk_balance: 4520,
  });
  const cleanupPromise = admin.from('pending_registrations').delete().eq('email', email);

  await Promise.all([profilePromise, cleanupPromise]);

  // --- Server-side sign-in fallback (optional) ---
  try {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey;
    const loginClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const loginRes = await loginClient.auth.signInWithPassword({ email, password });
    if (!loginRes.error && loginRes.data?.session) {
      sessionTokens = {
        access_token: loginRes.data.session.access_token,
        refresh_token: loginRes.data.session.refresh_token,
      };
    }
  } catch (err) {
    console.warn('[register-verify] Server sign-in failed (non-fatal):', err);
  }

  const response: Record<string, unknown> = {
    ok: true,
    message: 'Registration complete.',
    user_id: userId,
  };
  if (sessionTokens) {
    response.session = sessionTokens;
  }

  return json(response);
});
