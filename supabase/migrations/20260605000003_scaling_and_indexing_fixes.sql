-- ============================================================
-- SPARK — Scaling, Indexing & Concurrency Fixes
-- Migration: 20260605000003_scaling_and_indexing_fixes.sql
-- Beta preparation audit — 2026-06-05
-- ============================================================
-- Addresses:
--   1.  Missing B-tree indexes on FK columns (messages, reports,
--       unlocked_contacts, user_achievements, system_announcements)
--   2.  Missing indexes for high-traffic query patterns (messages,
--       ideas author/status/created_at)
--   3.  CRITICAL race condition in unlock_contact: EXISTS check
--       before FOR UPDATE creates a double-deduction window
--   4.  HIGH concurrent double-report in submit_report: unhandled
--       unique_violation under simultaneous identical requests
--   5.  HIGH race condition in invest_in_idea: ideas row not locked,
--       allowing stat corruption under simultaneous investments
--   6.  HIGH RLS policy on system_announcements uses a correlated
--       subquery that rescans profiles for every evaluated row;
--       replaced with a STABLE SECURITY DEFINER helper
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- SECTION 1: MISSING INDEXES
-- ══════════════════════════════════════════════════════════════

-- ── 1a. messages table (CRITICAL) ─────────────────────────────
-- channel_id and sender_id have no index at all.
-- Every chat open and realtime routing does a full table scan.

CREATE INDEX IF NOT EXISTS idx_messages_channel_id
  ON public.messages (channel_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);

-- Composite index for DM history query pattern:
--   WHERE (channel_id = A AND sender_id = B) OR (channel_id = B AND sender_id = A)
--   ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON public.messages (channel_id, created_at ASC);

-- Partial index for unread badge query:
--   WHERE channel_id = ME.id AND read = false
CREATE INDEX IF NOT EXISTS idx_messages_channel_unread
  ON public.messages (channel_id)
  WHERE read = false;

-- ── 1b. reports table (HIGH) ──────────────────────────────────
-- reporter_user_id FK has no index; needed for cascade deletes
-- and "has this user already reported?" existence checks.

CREATE INDEX IF NOT EXISTS idx_reports_reporter_user_id
  ON public.reports (reporter_user_id);

-- ── 1c. unlocked_contacts table (HIGH) ────────────────────────
-- contact_id FK has no index; only user_id is indexed.
-- Needed for cascade deletes and reverse-lookup queries.

CREATE INDEX IF NOT EXISTS idx_unlocked_contacts_contact
  ON public.unlocked_contacts (contact_id);

-- ── 1d. user_achievements table (HIGH) ────────────────────────
-- achievement_id FK has no index.

CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement
  ON public.user_achievements (achievement_id);

-- ── 1e. system_announcements table (MEDIUM) ───────────────────
-- updated_by FK has no index. Only 1 row but ensures FK hygiene.

CREATE INDEX IF NOT EXISTS idx_system_announcements_updated_by
  ON public.system_announcements (updated_by)
  WHERE updated_by IS NOT NULL;

-- ── 1f. ideas table (HIGH) ────────────────────────────────────
-- author_id has no index; used in:
--   - achievement checks (COUNT WHERE author_id = X AND status IN ...)
--   - profile stats (ideas_count query in fetchProfile)
--   - feed queries (ideas authored by current user)

CREATE INDEX IF NOT EXISTS idx_ideas_author_id
  ON public.ideas (author_id);

-- Composite partial index for the most common achievement query:
--   WHERE author_id = X AND status IN ('active', 'immune')
CREATE INDEX IF NOT EXISTS idx_ideas_author_active
  ON public.ideas (author_id)
  WHERE status IN ('active', 'immune');

-- Feed index: status filter + recency sort (covers loadIdeasFromDB)
CREATE INDEX IF NOT EXISTS idx_ideas_status_created
  ON public.ideas (created_at DESC)
  WHERE status IN ('active', 'immune');

-- expires_at index for time-remaining calculations
CREATE INDEX IF NOT EXISTS idx_ideas_expires_at
  ON public.ideas (expires_at)
  WHERE expires_at IS NOT NULL;


-- ══════════════════════════════════════════════════════════════
-- SECTION 2: RLS OPTIMISATION — admin check helper
-- ══════════════════════════════════════════════════════════════
-- The ann_admin_update policy on system_announcements uses:
--   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
-- as a correlated subquery. For a single-row table this is trivial,
-- but the same pattern will cause one profiles scan per row if ever
-- used on multi-row tables. Replace with a STABLE SECURITY DEFINER
-- function so Postgres can cache the result within the statement.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Re-create policy using the helper (avoids per-row subquery rescan)
DROP POLICY IF EXISTS "ann_admin_update" ON public.system_announcements;
CREATE POLICY "ann_admin_update" ON public.system_announcements
  FOR UPDATE TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════
-- SECTION 3: FIX unlock_contact — CRITICAL race condition
-- ══════════════════════════════════════════════════════════════
-- BUG: The original function checks "already unlocked?" with EXISTS
-- BEFORE acquiring the FOR UPDATE row lock on profiles. Two concurrent
-- calls from the same user can BOTH pass the check (contact not in
-- unlocked_contacts yet), BOTH lock the profile row sequentially, and
-- BOTH deduct SPK. The ON CONFLICT DO NOTHING prevents a duplicate
-- unlocked_contacts row, but the balance has been double-debited.
--
-- FIX: Acquire the FOR UPDATE lock on profiles FIRST, then check
-- whether the contact is already unlocked. This serialises all
-- concurrent calls for the same user and closes the window entirely.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.unlock_contact(
  p_contact_id UUID,
  p_cost       INTEGER
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'auth_required');
  END IF;

  IF v_user_id = p_contact_id THEN
    RETURN json_build_object('success', false, 'message', 'cannot_unlock_self');
  END IF;

  IF p_cost < 0 THEN
    RETURN json_build_object('success', false, 'message', 'invalid_cost');
  END IF;

  -- Lock the profile row FIRST — before any branching reads.
  -- Serialises all concurrent calls for the same user so only one
  -- transaction can be between the existence check and the deduction.
  SELECT spk_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'profile_not_found');
  END IF;

  -- Safe to check "already unlocked" now — no other concurrent call
  -- can reach this point while we hold the lock.
  IF EXISTS (
    SELECT 1 FROM public.unlocked_contacts
    WHERE user_id = v_user_id AND contact_id = p_contact_id
  ) THEN
    RETURN json_build_object('success', true, 'message', 'already_unlocked', 'new_balance', v_balance);
  END IF;

  IF v_balance < p_cost THEN
    RETURN json_build_object(
      'success',  false,
      'message',  'insufficient_balance',
      'balance',  v_balance,
      'required', p_cost
    );
  END IF;

  UPDATE public.profiles
  SET spk_balance = spk_balance - p_cost
  WHERE id = v_user_id
  RETURNING spk_balance INTO v_balance;

  -- ON CONFLICT is now a last-resort safety net, not the primary guard.
  INSERT INTO public.unlocked_contacts (user_id, contact_id)
  VALUES (v_user_id, p_contact_id)
  ON CONFLICT (user_id, contact_id) DO NOTHING;

  RETURN json_build_object('success', true, 'new_balance', v_balance);

EXCEPTION
  WHEN unique_violation THEN
    SELECT spk_balance INTO v_balance FROM public.profiles WHERE id = v_user_id;
    RETURN json_build_object('success', true, 'message', 'already_unlocked', 'new_balance', v_balance);
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'internal_error');
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_contact(UUID, INTEGER) TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- SECTION 4: FIX submit_report — concurrent double-report
-- ══════════════════════════════════════════════════════════════
-- BUG: The original function does a SELECT EXISTS check for the
-- existing report, then separately INSERTs. Two concurrent calls
-- from the SAME user for the SAME idea can both pass the check
-- (both see "not reported yet") and both try to INSERT. The second
-- INSERT throws an unhandled unique_violation that propagates as a
-- 500 error to the client.
--
-- Additionally, without locking the idea row, the threshold check
-- `IF v_new_count >= 3 THEN UPDATE ideas SET status = 'hidden'`
-- can run in two concurrent transactions simultaneously, potentially
-- causing a double-hide (idempotent, but messy) and two queue inserts
-- (the ON CONFLICT already handles this).
--
-- FIX:
--   a) Lock the idea row at the top of the function (FOR UPDATE)
--      so concurrent reports for the same post are fully serialised.
--   b) Replace the SELECT EXISTS + INSERT pattern with a single
--      INSERT ... ON CONFLICT DO NOTHING and use NOT FOUND to
--      detect the duplicate — atomic, no separate read needed.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION submit_report(p_idea_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idea      ideas%ROWTYPE;
  v_new_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Lock the idea row to serialise concurrent reports for the same post.
  -- This ensures the status transition to 'hidden' happens exactly once.
  SELECT * INTO v_idea FROM ideas WHERE id = p_idea_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'idea_not_found');
  END IF;

  IF v_idea.status = 'immune' THEN
    RETURN jsonb_build_object('error', 'post_is_immune');
  END IF;

  IF v_idea.status IN ('banned', 'hidden') THEN
    RETURN jsonb_build_object('error', 'post_already_moderated');
  END IF;

  -- Atomic insert with conflict guard: idempotent, no separate EXISTS read.
  -- FOUND is false when ON CONFLICT DO NOTHING suppresses the insert.
  INSERT INTO reports (idea_id, reporter_user_id)
  VALUES (p_idea_id, auth.uid())
  ON CONFLICT (idea_id, reporter_user_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'already_reported');
  END IF;

  UPDATE ideas
  SET report_count = report_count + 1
  WHERE id = p_idea_id
  RETURNING report_count INTO v_new_count;

  IF v_new_count >= 3 THEN
    UPDATE ideas SET status = 'hidden' WHERE id = p_idea_id;

    INSERT INTO moderation_queue (idea_id)
    VALUES (p_idea_id)
    ON CONFLICT (idea_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success',      true,
    'report_count', v_new_count,
    'queued',       (v_new_count >= 3)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_report(UUID) TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- SECTION 5: FIX invest_in_idea — ideas row not locked (HIGH)
-- ══════════════════════════════════════════════════════════════
-- BUG: The function deducts from profiles (atomically safe via the
-- WHERE spk_balance >= p_amount guard) then updates ideas.total_invested
-- and investment_history. Without a lock on the ideas row, two
-- simultaneous investments in the same idea can interleave their
-- array_append calls and corrupt investment_history.
--
-- FIX: Acquire FOR UPDATE on the ideas row before touching profiles.
-- Lock order (ideas → profiles) is consistent across all callers that
-- touch both rows; no deadlock risk since no other function locks
-- ideas first and profiles second simultaneously.
-- ══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.invest_in_idea(uuid, integer);

CREATE FUNCTION public.invest_in_idea(p_idea_id uuid, p_amount integer)
RETURNS TABLE(new_balance integer, new_total integer, new_history integer[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid         uuid;
  v_min_bet     integer;
  v_balance     integer;
  v_new_total   integer;
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

  RETURN QUERY SELECT v_balance,
                      COALESCE(v_new_total, 0),
                      COALESCE(v_new_history, ARRAY[]::integer[]);
END;
$$;

REVOKE ALL  ON FUNCTION public.invest_in_idea(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.invest_in_idea(uuid, integer) TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- SECTION 6: VERIFICATION
-- ══════════════════════════════════════════════════════════════

SELECT
  indexname   AS index_name,
  tablename   AS table_name,
  indexdef    AS definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'messages', 'reports', 'unlocked_contacts', 'user_achievements',
    'system_announcements', 'ideas', 'channel_members', 'repost_claims',
    'fraud_log', 'moderation_log'
  )
ORDER BY tablename, indexname;
