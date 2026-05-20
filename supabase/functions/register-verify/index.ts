import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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
  if (!supabaseUrl || !serviceKey) {
    return json({ message: 'Server configuration error' }, 500);
  }

  let payload: { email?: string; code?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ message: 'Invalid request' }, 400);
  }

  const email = normalizeEmail(payload.email || '');
  const code = String(payload.code || '').replace(/\D/g, '');
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
    return json({ message: 'Invalid session password. Please restart registration.' }, 400);
  }

  let userId: string | null = null;
  try {
    // 1. Check if user already exists
    const { data: existingUser } = await admin.auth.admin.getUserByEmail(email);
    if (existingUser && existingUser.user) {
      userId = existingUser.user.id;
    } else {
      // 2. Create the user natively via Supabase Admin API with confirmed email
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { username: pending.username }
      });
      if (createError) {
        return json({ message: 'Could not complete registration: ' + createError.message }, 400);
      }
      if (!createdUser || !createdUser.user) {
        return json({ message: 'Could not complete registration: user creation returned no data' }, 500);
      }
      userId = createdUser.user.id;
    }
  } catch (err: any) {
    console.error('[register-verify] Direct DB execution failed:', err.message || err);
    return json({ message: 'Could not complete registration: ' + (err.message || String(err)) }, 500);
  }

  // --- Parallel background: profiles upsert + pending cleanup ---
  const profilePromise = admin.from('profiles').upsert({
    id: userId,
    username: pending.username,
    spk_balance: 4520,
  });
  const cleanupPromise = admin.from('pending_registrations').delete().eq('email', email);

  await Promise.all([profilePromise, cleanupPromise]);

  // --- Server-side sign-in replacement using generateLink ---
  let tokenHash: string | null = null;
  try {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });
    if (!linkError && linkData?.properties?.hashed_token) {
      tokenHash = linkData.properties.hashed_token;
    } else if (linkError) {
      console.warn('[register-verify] Generate link error:', linkError.message);
    }
  } catch (err) {
    console.warn('[register-verify] Server link generation failed (non-fatal):', err);
  }

  const response: Record<string, unknown> = {
    ok: true,
    message: 'Registration complete.',
    user_id: userId,
  };
  if (tokenHash) {
    response.token_hash = tokenHash;
  }

  return json(response);
});
