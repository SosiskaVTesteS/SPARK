-- Migration: update invest_in_idea to track total_invested and investment_history
-- Also update profiles to track investments_count

-- Drop old function first (return type is changing)
DROP FUNCTION IF EXISTS public.invest_in_idea(uuid, integer);

-- Add investments_count to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS investments_count integer NOT NULL DEFAULT 0;

-- Recreate the RPC with full idea update logic
CREATE OR REPLACE FUNCTION public.invest_in_idea(p_idea_id uuid, p_amount integer)
RETURNS TABLE(new_balance integer, new_total integer, new_history integer[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_uid uuid;
  v_min_bet integer;
  v_balance integer;
  v_new_total integer;
  v_new_history integer[];
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  -- Handle dummy UUID for mock/demo ideas (local state only)
  if p_idea_id = '00000000-0000-0000-0000-000000000000'::uuid then
    update public.profiles
    set spk_balance = spk_balance - p_amount,
        investments_count = investments_count + 1
    where id = v_uid
      and spk_balance >= p_amount
    returning spk_balance into v_balance;
    if v_balance is null then
      raise exception 'insufficient_balance';
    end if;
    return query select v_balance, 0, ARRAY[]::integer[];
    return;
  end if;

  -- Real idea: validate
  select min_bet
  into v_min_bet
  from public.ideas
  where id = p_idea_id;

  if v_min_bet is null then
    raise exception 'idea_not_found';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  if p_amount < v_min_bet then
    raise exception 'amount_below_min_bet';
  end if;

  -- Deduct from user balance, increment investments_count
  update public.profiles
  set spk_balance = spk_balance - p_amount,
      investments_count = investments_count + 1
  where id = v_uid
    and spk_balance >= p_amount
  returning spk_balance into v_balance;

  if v_balance is null then
    raise exception 'insufficient_balance';
  end if;

  -- Update idea: add to total_invested and append to investment_history
  update public.ideas
  set total_invested = COALESCE(total_invested, 0) + p_amount,
      investment_history = array_append(
        COALESCE(investment_history, ARRAY[]::integer[]),
        COALESCE(total_invested, 0) + p_amount
      )
  where id = p_idea_id
  returning total_invested, investment_history into v_new_total, v_new_history;

  return query select v_balance, COALESCE(v_new_total, 0), COALESCE(v_new_history, ARRAY[]::integer[]);
end;
$$;
