-- ============================================================
-- SPARK — Платные контакты и участники каналов
-- Миграция: 20260604_unlocked_contacts.sql
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. Разблокированные контакты
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unlocked_contacts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_contact UNIQUE (user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_unlocked_contacts_user
  ON public.unlocked_contacts(user_id);

ALTER TABLE public.unlocked_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uc_select_own" ON public.unlocked_contacts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "uc_insert_own" ON public.unlocked_contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- 2. RPC: unlock_contact — безопасное списание + разблокировка
-- ──────────────────────────────────────────────────────────
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

  -- Контакт уже разблокирован — возвращаем успех без списания
  IF EXISTS (
    SELECT 1 FROM public.unlocked_contacts
    WHERE user_id = v_user_id AND contact_id = p_contact_id
  ) THEN
    SELECT spk_balance INTO v_balance
    FROM public.profiles WHERE id = v_user_id;
    RETURN json_build_object('success', true, 'message', 'already_unlocked', 'new_balance', v_balance);
  END IF;

  -- Блокируем строку профиля (FOR UPDATE — race-condition guard)
  SELECT spk_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'profile_not_found');
  END IF;

  IF v_balance < p_cost THEN
    RETURN json_build_object(
      'success',  false,
      'message',  'insufficient_balance',
      'balance',  v_balance,
      'required', p_cost
    );
  END IF;

  -- Списываем
  UPDATE public.profiles
  SET spk_balance = spk_balance - p_cost
  WHERE id = v_user_id
  RETURNING spk_balance INTO v_balance;

  -- Фиксируем разблокировку
  INSERT INTO public.unlocked_contacts (user_id, contact_id)
  VALUES (v_user_id, p_contact_id)
  ON CONFLICT (user_id, contact_id) DO NOTHING;

  RETURN json_build_object('success', true, 'new_balance', v_balance);

EXCEPTION
  WHEN unique_violation THEN
    -- Параллельный вызов успел вставить раньше — всё равно успех
    SELECT spk_balance INTO v_balance FROM public.profiles WHERE id = v_user_id;
    RETURN json_build_object('success', true, 'message', 'already_unlocked', 'new_balance', v_balance);
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'internal_error');
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_contact(UUID, INTEGER) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 3. Участники групповых каналов
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.channel_members (
  channel_id TEXT        NOT NULL,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_channel_member UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user
  ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel
  ON public.channel_members(channel_id);

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cm_select_own" ON public.channel_members
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "cm_insert_own" ON public.channel_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- Проверка
-- ──────────────────────────────────────────────────────────
SELECT 'table: unlocked_contacts' AS check_name, 'OK' AS status
  WHERE EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unlocked_contacts')
UNION ALL
SELECT 'fn: unlock_contact', 'OK'
  WHERE EXISTS (SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'unlock_contact')
UNION ALL
SELECT 'table: channel_members', 'OK'
  WHERE EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'channel_members');
