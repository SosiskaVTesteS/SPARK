-- Migration: 20260607000004_fix_invest_rpc.sql
-- Adds a self-investment guard to invest_in_idea and fixes ERRCODE values
-- so client-side error string matching works correctly.
--
-- ERRCODEs used:
--   P0001 — auth_required
--   P0002 — idea_not_found
--   P0003 — cannot_invest_in_own_idea
--   P0004 — insufficient_balance

DROP FUNCTION IF EXISTS public.invest_in_idea(uuid, integer);

CREATE FUNCTION public.invest_in_idea(p_idea_id uuid, p_amount integer)
RETURNS TABLE(new_balance integer, new_total integer, new_history integer[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid         uuid;
  v_author_id   uuid;
  v_min_bet     integer;
  v_balance     integer;
  v_new_total   integer;
  v_new_history integer[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = 'P0001';
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
      RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0004';
    END IF;
    RETURN QUERY SELECT v_balance, 0, ARRAY[]::integer[];
    RETURN;
  END IF;

  -- Lock the idea row first to prevent concurrent stat corruption.
  SELECT min_bet, author_id
  INTO v_min_bet, v_author_id
  FROM public.ideas
  WHERE id = p_idea_id
  FOR UPDATE;

  IF v_min_bet IS NULL THEN
    RAISE EXCEPTION 'idea_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Block self-investment.
  IF v_author_id = v_uid THEN
    RAISE EXCEPTION 'cannot_invest_in_own_idea' USING ERRCODE = 'P0003';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0005';
  END IF;

  IF p_amount < v_min_bet THEN
    RAISE EXCEPTION 'amount_below_min_bet' USING ERRCODE = 'P0006';
  END IF;

  -- Deduct from profile atomically (WHERE guard prevents overdraft).
  UPDATE public.profiles
  SET spk_balance       = spk_balance - p_amount,
      investments_count = investments_count + 1
  WHERE id = v_uid
    AND spk_balance >= p_amount
  RETURNING spk_balance INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0004';
  END IF;

  -- Update idea stats; we hold FOR UPDATE so array_append is race-free.
  UPDATE public.ideas
  SET total_invested     = COALESCE(total_invested, 0) + p_amount,
      investment_history = array_append(
        COALESCE(investment_history, ARRAY[]::integer[]),
        COALESCE(total_invested, 0) + p_amount
      )
  WHERE id = p_idea_id
  RETURNING total_invested, investment_history INTO v_new_total, v_new_history;

  RETURN QUERY SELECT v_balance,
                      COALESCE(v_new_total, 0),
                      COALESCE(v_new_history, ARRAY[]::integer[]);
END;
$$;

REVOKE ALL  ON FUNCTION public.invest_in_idea(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.invest_in_idea(uuid, integer) TO authenticated;
