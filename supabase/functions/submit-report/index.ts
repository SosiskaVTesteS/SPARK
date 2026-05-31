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

// Maps RPC error codes to HTTP status codes
const ERROR_STATUS: Record<string, number> = {
  unauthorized:           401,
  idea_not_found:         404,
  post_is_immune:         403,
  already_reported:       409,
  post_already_moderated: 409,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return json({ message: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[submit-report] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return json({ message: 'Server configuration error' }, 500);
  }

  let payload: { idea_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ message: 'Invalid request body' }, 400);
  }

  const ideaId = (payload.idea_id || '').trim();
  if (!ideaId) return json({ message: 'idea_id is required' }, 400);

  // Create a client using the user's JWT — this makes auth.uid() work inside the RPC
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Delegate all logic to the submit_report RPC (atomic SQL transaction)
  const { data, error } = await userClient.rpc('submit_report', { p_idea_id: ideaId });

  if (error) {
    console.error('[submit-report] RPC error:', error.message);
    return json({ message: error.message }, 500);
  }

  if (data?.error) {
    const status = ERROR_STATUS[data.error as string] ?? 400;
    return json({ ok: false, message: data.error }, status);
  }

  return json({
    ok: true,
    report_count: data.report_count,
    queued: data.queued,
  });
});
