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

// Pre-create admin client once at module level for warm invocation reuse
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const admin = (supabaseUrl && serviceKey)
  ? createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  if (!admin) {
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

  // ── Step 1: Fetch pending registration record ──────────────────────────────
  const { data: pending, error: fetchError } = await admin
    .from('pending_registrations')
    .select('email, code_hash, password_hash, expires_at, attempts, username')
    .eq('email', email)
    .maybeSingle();

  if (fetchError || !pending) {
    return json({ message: 'Invalid verification code' }, 400);
  }

  if (new Date(pending.expires_at).getTime() < Date.now()) {
    // Fire-and-forget cleanup
    admin.from('pending_registrations').delete().eq('email', email);
    return json({ message: 'Verification code expired' }, 400);
  }

  if ((pending.attempts ?? 0) >= 5) {
    return json({ message: 'Too many attempts. Request a new code.' }, 429);
  }

  // ── Step 2: Validate code + password hashes in parallel ───────────────────
  const [codeHash, passwordHash] = await Promise.all([
    sha256(code + ':' + email),
    sha256(password + ':' + pepper()),
  ]);

  if (codeHash !== pending.code_hash) {
    // Fire-and-forget attempts increment
    admin
      .from('pending_registrations')
      .update({ attempts: (pending.attempts || 0) + 1 })
      .eq('email', email);
    return json({ message: 'Invalid verification code' }, 400);
  }

  if (passwordHash !== pending.password_hash) {
    return json({ message: 'Invalid session password. Please restart registration.' }, 400);
  }

  // ── Step 3: Create user via Admin Auth API ──────────────────────────────────
  // Try to create the user. If email already exists, fetch the existing user ID.
  let userId: string;
  try {
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: pending.username },
    });

    if (createError) {
      // If the email already exists, reuse the existing account
      if (
        createError.message?.toLowerCase().includes('already') ||
        createError.message?.toLowerCase().includes('exists') ||
        createError.status === 422
      ) {
        const { data: existing } = await admin.auth.admin.getUserByEmail(email);
        if (existing?.user?.id) {
          userId = existing.user.id;
        } else {
          return json({ message: 'Registration failed: ' + createError.message }, 400);
        }
      } else {
        return json({ message: 'Registration failed: ' + createError.message }, 400);
      }
    } else if (!createdUser?.user?.id) {
      return json({ message: 'Registration failed: no user data returned' }, 500);
    } else {
      userId = createdUser.user.id;
    }
  } catch (err: any) {
    console.error('[register-verify] createUser error:', err.message || err);
    return json({ message: 'Registration error: ' + (err.message || String(err)) }, 500);
  }

  // ── Step 4: Parallel post-registration tasks ───────────────────────────────
  // Run profile upsert, pending cleanup, and magic-link generation concurrently.
  const [, , linkResult] = await Promise.allSettled([
    admin.from('profiles').upsert({
      id: userId,
      username: pending.username,
      spk_balance: 4520,
    }),
    admin.from('pending_registrations').delete().eq('email', email),
    admin.auth.admin.generateLink({ type: 'magiclink', email }),
  ]);

  const response: Record<string, unknown> = {
    ok: true,
    message: 'Registration complete.',
    user_id: userId,
  };

  if (linkResult.status === 'fulfilled') {
    const { data: linkData, error: linkError } = linkResult.value as any;
    if (!linkError && linkData?.properties?.hashed_token) {
      response.token_hash = linkData.properties.hashed_token;
    }
  }

  return json(response);
});
