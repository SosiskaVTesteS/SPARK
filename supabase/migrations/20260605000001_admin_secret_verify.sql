-- Migration: server-side admin 2FA secret verification
-- The shared secret code lives ONLY inside this function body on the Supabase server.
-- It is never sent to the browser.

CREATE OR REPLACE FUNCTION public.verify_admin_secret(p_code TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin    boolean;
  v_correct_code CONSTANT TEXT := 'SPARK-IGNITE-777';
BEGIN
  -- Caller must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'not_authenticated');
  END IF;

  -- Caller must be flagged as an admin in the profiles table
  SELECT is_admin INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN json_build_object('success', false, 'message', 'not_admin');
  END IF;

  -- Verify the submitted code
  IF p_code IS DISTINCT FROM v_correct_code THEN
    RETURN json_build_object('success', false, 'message', 'wrong_code');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_secret(TEXT) TO authenticated;
