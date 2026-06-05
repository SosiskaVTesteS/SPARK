-- Migration: fix admin_delete_idea to correctly map fields for banned_posts and handle NOT NULL constraint
-- 20260605000002_fix_admin_delete_idea.sql

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
    INSERT INTO public.banned_posts (idea_id, original_text, author_user_id, banned_at, ai_reasoning)
    SELECT id, COALESCE(title, '') || E'\n\n' || COALESCE(description, ''), author_id, now(), 'admin_delete'
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
