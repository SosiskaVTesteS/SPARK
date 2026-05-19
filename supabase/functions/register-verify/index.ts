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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function pepper() {
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

  // --- Create user ---
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: pending.username },
  });

  let userId = created?.user?.id;
  let sessionTokens: { access_token: string; refresh_token: string } | null = null;

  if (createError) {
    const msg = (createError.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      // Self-healing: user was created by a previous timed-out request
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey;
      const userClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError || !signInData.user) {
        return json({ message: 'This email is already registered.' }, 400);
      }
      userId = signInData.user.id;
      if (signInData.session) {
        sessionTokens = {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        };
      }
    } else {
      console.error('[register-verify] createUser error:', createError.message);
      return json({ message: 'Could not complete registration' }, 500);
    }
  }

  if (!userId) {
    return json({ message: 'Could not complete registration' }, 500);
  }

  // --- Parallel: profile + cleanup + server-side sign-in (if needed) ---
  const profilePromise = admin.from('profiles').upsert({
    id: userId,
    username: pending.username,
    spk_balance: 4520,
  });
  const cleanupPromise = admin.from('pending_registrations').delete().eq('email', email);

  if (!sessionTokens) {
    // Sign in on server (same datacenter = ~50ms network vs ~500ms from mobile)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey;
    const loginClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [profileRes, , loginRes] = await Promise.all([
      profilePromise,
      cleanupPromise,
      loginClient.auth.signInWithPassword({ email, password }),
    ]);
    if (profileRes.error) {
      console.error('[register-verify] profile upsert error:', profileRes.error.message);
    }
    if (!loginRes.error && loginRes.data?.session) {
      sessionTokens = {
        access_token: loginRes.data.session.access_token,
        refresh_token: loginRes.data.session.refresh_token,
      };
    }
  } else {
    // Already have session from self-healing path
    const [profileRes] = await Promise.all([profilePromise, cleanupPromise]);
    if (profileRes.error) {
      console.error('[register-verify] profile upsert error:', profileRes.error.message);
    }
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
