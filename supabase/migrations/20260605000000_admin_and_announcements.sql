-- ============================================================
-- SPARK — Admin roles & System Announcements
-- Migration: 20260605000000_admin_and_announcements.sql
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. Add is_admin column to profiles
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
  ON public.profiles (is_admin)
  WHERE is_admin = TRUE;


-- ──────────────────────────────────────────────────────────
-- 2. System announcements (single-row config table)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_announcements (
  id         INTEGER     PRIMARY KEY DEFAULT 1,
  message    TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Ensure the single row exists
INSERT INTO public.system_announcements (id, message)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ann_public_read"  ON public.system_announcements;
CREATE POLICY "ann_public_read" ON public.system_announcements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ann_admin_update" ON public.system_announcements;
CREATE POLICY "ann_admin_update" ON public.system_announcements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ──────────────────────────────────────────────────────────
-- 3. RPC: get_admin_stats — total users + total SPK (non-admin)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin     boolean;
  v_total_users  integer;
  v_total_spk    numeric;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN json_build_object('success', false, 'message', 'not_admin');
  END IF;

  SELECT COUNT(*) INTO v_total_users FROM public.profiles;

  SELECT COALESCE(SUM(spk_balance), 0) INTO v_total_spk
  FROM public.profiles
  WHERE is_admin = FALSE OR is_admin IS NULL;

  RETURN json_build_object(
    'success',     true,
    'total_users', v_total_users,
    'total_spk',   v_total_spk
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 4. RPC: set_announcement — admin sets/clears the banner
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_announcement(p_message TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN json_build_object('success', false, 'message', 'not_admin');
  END IF;

  UPDATE public.system_announcements
  SET
    message    = NULLIF(TRIM(COALESCE(p_message, '')), ''),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 1;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_announcement(TEXT) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 5. RPC: admin_delete_idea — hard-delete idea, archive to banned_posts
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_idea(p_idea_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN json_build_object('success', false, 'message', 'not_admin');
  END IF;

  -- Archive to banned_posts if the table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'banned_posts'
  ) THEN
    INSERT INTO public.banned_posts (idea_id, banned_at, reason)
    SELECT id, now(), 'admin_delete'
    FROM public.ideas
    WHERE id = p_idea_id
    ON CONFLICT DO NOTHING;
  END IF;

  -- Delete the idea
  DELETE FROM public.ideas WHERE id = p_idea_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_idea(UUID) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 6. Verification
-- ──────────────────────────────────────────────────────────
SELECT 'column: profiles.is_admin'      AS check_name, 'OK' AS status
  WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
  )
UNION ALL
SELECT 'table: system_announcements', 'OK'
  WHERE EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_announcements'
  )
UNION ALL
SELECT 'fn: get_admin_stats', 'OK'
  WHERE EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_admin_stats'
  )
UNION ALL
SELECT 'fn: set_announcement', 'OK'
  WHERE EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'set_announcement'
  )
UNION ALL
SELECT 'fn: admin_delete_idea', 'OK'
  WHERE EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'admin_delete_idea'
  );
