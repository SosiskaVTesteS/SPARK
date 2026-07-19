-- Migration: add RPC functions for Leaders page metrics
-- Functions for top by accuracy and rising stars

-- ═══ RPC: get_top_by_accuracy ═══
-- Calculate accuracy as: successful ideas / total ideas
-- Successful = ideas with total_invested > min_bet * 3 (at least 3x return)
CREATE OR REPLACE FUNCTION public.get_top_by_accuracy(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_color SMALLINT,
  accuracy NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_color,
    CASE 
      WHEN COUNT(i.id) > 0 THEN 
        (COUNT(CASE WHEN i.total_invested >= (i.min_bet * 3) THEN 1 END)::NUMERIC / COUNT(i.id)) * 100
      ELSE 0
    END AS accuracy
  FROM profiles p
  LEFT JOIN ideas i ON i.author_id = p.id AND i.status IN ('active', 'immune')
  WHERE p.is_admin IS NULL OR p.is_admin = false
  GROUP BY p.id, p.username, p.avatar_color
  HAVING COUNT(i.id) > 0
  ORDER BY accuracy DESC, COUNT(i.id) DESC
  LIMIT limit_count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_top_by_accuracy(INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.get_top_by_accuracy(INTEGER) TO authenticated;

-- ═══ RPC: get_rising_stars ═══
-- Get users with highest balance growth in specified period
CREATE OR REPLACE FUNCTION public.get_rising_stars(days_ago INTEGER DEFAULT 7, limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_color SMALLINT,
  growth INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  v_cutoff_date := NOW() - (days_ago || ' days')::INTERVAL;
  
  RETURN QUERY
  WITH balance_changes AS (
    SELECT 
      user_id,
      SUM(balance_change) AS total_growth
    FROM spk_balance_history
    WHERE created_at >= v_cutoff_date
      AND balance_change > 0
    GROUP BY user_id
  )
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_color,
    COALESCE(bc.total_growth, 0) AS growth
  FROM profiles p
  LEFT JOIN balance_changes bc ON bc.user_id = p.id
  WHERE p.is_admin IS NULL OR p.is_admin = false
  ORDER BY growth DESC
  LIMIT limit_count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rising_stars(INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.get_rising_stars(INTEGER, INTEGER) TO authenticated;

-- ═══ RPC: get_leaders_by_period ═══
-- Get leaders ranked by SPK growth in specified period
CREATE OR REPLACE FUNCTION public.get_leaders_by_period(period TEXT DEFAULT 'all', limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_color SMALLINT,
  spk_balance INTEGER,
  investments_count INTEGER,
  period_growth INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  -- Calculate cutoff date based on period
  IF period = 'week' THEN
    v_cutoff_date := NOW() - '7 days'::INTERVAL;
  ELSIF period = 'month' THEN
    v_cutoff_date := NOW() - '30 days'::INTERVAL;
  ELSE
    v_cutoff_date := NULL; -- All time
  END IF;
  
  IF v_cutoff_date IS NULL THEN
    -- All time: just return current balance ranking
    RETURN QUERY
    SELECT 
      p.id AS user_id,
      p.username,
      p.avatar_color,
      p.spk_balance,
      p.investments_count,
      0 AS period_growth
    FROM profiles p
    WHERE p.is_admin IS NULL OR p.is_admin = false
    ORDER BY p.spk_balance DESC
    LIMIT limit_count;
  ELSE
    -- Period-based: calculate growth in period
    RETURN QUERY
    WITH period_growth AS (
      SELECT 
        user_id,
        SUM(balance_change) AS total_growth
      FROM spk_balance_history
      WHERE created_at >= v_cutoff_date
      GROUP BY user_id
    )
    SELECT 
      p.id AS user_id,
      p.username,
      p.avatar_color,
      p.spk_balance,
      p.investments_count,
      COALESCE(pg.total_growth, 0) AS period_growth
    FROM profiles p
    LEFT JOIN period_growth pg ON pg.user_id = p.id
    WHERE p.is_admin IS NULL OR p.is_admin = false
    ORDER BY pg.total_growth DESC NULLS LAST, p.spk_balance DESC
    LIMIT limit_count;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaders_by_period(TEXT, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.get_leaders_by_period(TEXT, INTEGER) TO authenticated;

-- Verification
SELECT 'function: get_top_by_accuracy' AS check_name, 'OK' AS status
  WHERE EXISTS (SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_top_by_accuracy')
UNION ALL
SELECT 'function: get_rising_stars', 'OK'
  WHERE EXISTS (SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_rising_stars')
UNION ALL
SELECT 'function: get_leaders_by_period', 'OK'
  WHERE EXISTS (SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_leaders_by_period');
