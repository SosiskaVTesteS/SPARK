-- Migration: Update invest_in_idea to log investment activity
-- This adds the call to log_investment_to_activity helper function

-- Get the current invest_in_idea function definition and update it
CREATE OR REPLACE FUNCTION public.invest_in_idea(p_idea_id uuid, p_amount integer)
RETURNS TABLE (new_balance integer, new_total_invested integer, new_investment_history integer[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_min_bet integer;
  v_balance integer;
  v_new_total integer;
  v_new_history integer[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  -- Handle dummy UUID for mock/demo ideas (local state only — no DB row)
  IF p_idea_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    UPDATE public.profiles
    SET spk_balance       = spk_balance - p_amount,
        investments_count = investments_count + 1
    WHERE id = v_uid
      AND spk_balance >= p_amount
    RETURNING spk_balance INTO v_balance;
    IF v_balance IS NULL THEN
      RAISE EXCEPTION 'insufficient_balance';
    END IF;
    -- Log the investment activity
    PERFORM public.log_investment_to_activity(v_uid, p_idea_id, p_amount::BIGINT);
    RETURN QUERY SELECT v_balance, 0, ARRAY[]::integer[];
    RETURN;
  END IF;

  -- Lock the idea row FIRST to prevent concurrent stat corruption.
  -- Both total_invested and investment_history must be updated atomically
  -- with respect to other simultaneous investments in the same idea.
  SELECT min_bet INTO v_min_bet
  FROM public.ideas
  WHERE id = p_idea_id
  FOR UPDATE;

  IF v_min_bet IS NULL THEN
    RAISE EXCEPTION 'idea_not_found';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_amount < v_min_bet THEN
    RAISE EXCEPTION 'amount_below_min_bet';
  END IF;

  -- Deduct from profile atomically (WHERE guard prevents overdraft)
  UPDATE public.profiles
  SET spk_balance       = spk_balance - p_amount,
      investments_count = investments_count + 1
  WHERE id = v_uid
    AND spk_balance >= p_amount
  RETURNING spk_balance INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Update idea stats; we hold FOR UPDATE so array_append is race-free
  UPDATE public.ideas
  SET total_invested    = COALESCE(total_invested, 0) + p_amount,
      investment_history = array_append(
        COALESCE(investment_history, ARRAY[]::integer[]),
        COALESCE(total_invested, 0) + p_amount
      )
  WHERE id = p_idea_id
  RETURNING total_invested, investment_history INTO v_new_total, v_new_history;

  -- Log the investment activity for Live Activity feed
  PERFORM public.log_investment_to_activity(v_uid, p_idea_id, p_amount::BIGINT);

  RETURN QUERY SELECT v_balance,
                      COALESCE(v_new_total, 0),
                      COALESCE(v_new_history, ARRAY[]::integer[]);
END;
$$;

REVOKE ALL ON FUNCTION public.invest_in_idea(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.invest_in_idea(uuid, integer) TO authenticated;
