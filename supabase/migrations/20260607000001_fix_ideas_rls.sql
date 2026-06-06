-- Migration: 20260607000001_fix_ideas_rls.sql
-- Enable RLS on public.ideas and add correct access policies.
-- Without these, authenticated inserts are rejected by Postgres
-- and the feed returns empty for unauthenticated visitors.

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read published ideas.
DROP POLICY IF EXISTS "ideas_select_public" ON public.ideas;
CREATE POLICY "ideas_select_public" ON public.ideas
  FOR SELECT
  USING (true);

-- Only the author can insert their own idea.
DROP POLICY IF EXISTS "ideas_insert_author" ON public.ideas;
CREATE POLICY "ideas_insert_author" ON public.ideas
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Only the author can update their own idea.
DROP POLICY IF EXISTS "ideas_update_author" ON public.ideas;
CREATE POLICY "ideas_update_author" ON public.ideas
  FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Only the author can delete their own idea.
DROP POLICY IF EXISTS "ideas_delete_author" ON public.ideas;
CREATE POLICY "ideas_delete_author" ON public.ideas
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- SECURITY DEFINER functions (invest_in_idea, admin_delete_idea, submit_report,
-- cyber_judge) bypass RLS because they run as the function owner, so existing
-- RPCs are unaffected by these policies.
