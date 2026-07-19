-- Migration: Add investment activity log for Live Activity feed
-- This table tracks all investments for real-time activity feed

-- Create table for investment activity log
CREATE TABLE IF NOT EXISTS public.investment_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.auth.users(id) ON DELETE CASCADE,
  idea_id UUID NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add index for efficient querying of recent activity
CREATE INDEX IF NOT EXISTS investment_activity_log_created_at_idx 
  ON public.investment_activity_log(created_at DESC);

-- Add index for filtering by idea
CREATE INDEX IF NOT EXISTS investment_activity_log_idea_id_idx 
  ON public.investment_activity_log(idea_id);

-- Enable Row Level Security
ALTER TABLE public.investment_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users can read all activity (for the feed)
CREATE POLICY "Authenticated users can read investment activity" 
  ON public.investment_activity_log FOR SELECT 
  TO authenticated USING (true);

-- No insert policy - inserts are done via RPC function only

-- Set replica identity to FULL for Realtime
ALTER TABLE public.investment_activity_log REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.investment_activity_log;

-- ═══ Helper function to log investment activity ═══
-- This function will be called from invest_in_idea RPC
CREATE OR REPLACE FUNCTION public.log_investment_to_activity(p_user_id UUID, p_idea_id UUID, p_amount BIGINT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.investment_activity_log (user_id, idea_id, amount, created_at)
  VALUES (p_user_id, p_idea_id, p_amount, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the helper function
GRANT EXECUTE ON FUNCTION public.log_investment_to_activity(UUID, UUID, BIGINT) TO authenticated;
