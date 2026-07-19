-- Migration: add spk_balance_history table for tracking balance changes over time
-- This enables period-based filtering (week/month/all-time) and progress tracking

CREATE TABLE IF NOT EXISTS public.spk_balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_after INTEGER NOT NULL,
  balance_change INTEGER NOT NULL, -- Positive for gains, negative for losses
  reason TEXT NOT NULL, -- 'invest', 'daily_bonus', 'achievement', etc.
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context (e.g., idea_id, achievement_id)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient time-range queries per user
CREATE INDEX IF NOT EXISTS idx_spk_balance_history_user_created
  ON public.spk_balance_history(user_id, created_at DESC);

-- Index for period-based queries (all users, time range)
CREATE INDEX IF NOT EXISTS idx_spk_balance_history_created
  ON public.spk_balance_history(created_at DESC);

-- RLS: users can read their own history, service role can write
ALTER TABLE public.spk_balance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own balance history"
  ON public.spk_balance_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert balance history"
  ON public.spk_balance_history FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Function to log balance changes automatically via trigger
CREATE OR REPLACE FUNCTION public.log_balance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance INTEGER;
  v_new_balance INTEGER;
  v_change INTEGER;
  v_reason TEXT;
BEGIN
  -- Only log actual balance changes
  IF OLD.spk_balance IS NOT NULL AND NEW.spk_balance IS NOT NULL THEN
    v_old_balance := OLD.spk_balance;
    v_new_balance := NEW.spk_balance;
    v_change := v_new_balance - v_old_balance;
    
    -- Skip if no change
    IF v_change = 0 THEN
      RETURN NEW;
    END IF;
    
    -- Determine reason based on context (can be overridden via metadata)
    v_reason := TG_OP;
    
    INSERT INTO public.spk_balance_history (user_id, balance_after, balance_change, reason, metadata)
    VALUES (NEW.id, v_new_balance, v_change, v_reason, 
             jsonb_build_object('trigger', TG_OP, 'old_balance', v_old_balance));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically log balance changes on profiles table
DROP TRIGGER IF EXISTS trigger_log_balance_change ON public.profiles;
CREATE TRIGGER trigger_log_balance_change
  AFTER UPDATE OF spk_balance ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_balance_change();

-- Function to manually log balance changes (for RPC calls)
CREATE OR REPLACE FUNCTION public.record_balance_change(
  p_user_id UUID,
  p_balance_after INTEGER,
  p_balance_change INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id UUID;
BEGIN
  INSERT INTO public.spk_balance_history (user_id, balance_after, balance_change, reason, metadata)
  VALUES (p_user_id, p_balance_after, p_balance_change, p_reason, p_metadata)
  RETURNING id INTO v_record_id;
  
  RETURN v_record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_balance_change FROM public;
GRANT EXECUTE ON FUNCTION public.record_balance_change TO authenticated;

-- Verification
SELECT 'table: spk_balance_history' AS check_name, 'OK' AS status
  WHERE EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spk_balance_history')
UNION ALL
SELECT 'index: idx_spk_balance_history_user_created', 'OK'
  WHERE EXISTS (SELECT 1 FROM pg_indexes
    WHERE tablename = 'spk_balance_history' AND indexname = 'idx_spk_balance_history_user_created')
UNION ALL
SELECT 'index: idx_spk_balance_history_created', 'OK'
  WHERE EXISTS (SELECT 1 FROM pg_indexes
    WHERE tablename = 'spk_balance_history' AND indexname = 'idx_spk_balance_history_created')
UNION ALL
SELECT 'trigger: trigger_log_balance_change', 'OK'
  WHERE EXISTS (SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trigger_log_balance_change' AND event_object_table = 'profiles')
UNION ALL
SELECT 'function: record_balance_change', 'OK'
  WHERE EXISTS (SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'record_balance_change');
