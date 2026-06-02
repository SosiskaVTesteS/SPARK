-- ============================================================
-- SPARK — Система достижений и вознаграждений за репосты
-- Миграция: 20260602_achievements_and_reposts.sql
-- Запускай ВСЁ сразу одной кнопкой RUN (F5) в Supabase SQL Editor
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. Справочник достижений
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.achievements (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_spk  INT  NOT NULL CHECK (reward_spk > 0)
);

INSERT INTO public.achievements (id, title, description, reward_spk) VALUES
  ('fill_profile',   'Заполненный профиль',  'Укажите уникальный никнейм и заполните информацию о себе (Bio)', 100),
  ('create_5_ideas', 'Генератор стартапов',  'Опубликуйте как минимум 5 идей на платформе SPARK',             100),
  ('adv_repost',     'Амбассадор SPARK',     'Поделитесь ссылкой на наш сайт в соцсетях и получите награду',   50)
ON CONFLICT (id) DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- 2. Полученные награды пользователей
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT        NOT NULL REFERENCES public.achievements(id),
  claimed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Главная защита от двойного начисления SPK
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON public.user_achievements(user_id);

-- RLS: пользователь видит только свои записи
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ua_select_own" ON public.user_achievements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────
-- 3. Заявки на рекламные репосты
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.repost_claims (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  repost_link  TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  ai_verdict   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Быстрый поиск последней заявки пользователя (для rate limit)
CREATE INDEX IF NOT EXISTS idx_repost_claims_user_created
  ON public.repost_claims(user_id, created_at DESC);

-- Быстрый поиск одобренных заявок
CREATE INDEX IF NOT EXISTS idx_repost_claims_user_status
  ON public.repost_claims(user_id, status);

-- RLS: вставку делает только Edge Function через service_role (обходит RLS);
--      пользователь может только читать свои заявки
ALTER TABLE public.repost_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_select_own" ON public.repost_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────
-- 4. RPC: claim_achievement — безопасное получение ачивки
--    Паттерн: FOR UPDATE + SECURITY DEFINER (как claim_daily_bonus)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_achievement(p_achievement_id TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_balance    NUMERIC;
  v_reward     INT;
  v_bio        TEXT;
  v_username   TEXT;
  v_ideas_cnt  BIGINT;
  v_has_repost BOOLEAN;
BEGIN
  -- Авторизация
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'auth_required');
  END IF;

  -- Проверяем, что ачивка существует и узнаём размер награды
  SELECT reward_spk INTO v_reward
  FROM public.achievements
  WHERE id = p_achievement_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'achievement_not_found');
  END IF;

  -- Блокируем строку профиля (FOR UPDATE — защита от race conditions/двойных кликов)
  SELECT spk_balance, bio, username
  INTO v_balance, v_bio, v_username
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'profile_not_found');
  END IF;

  -- Явная проверка дубля (UNIQUE constraint тоже защитит, но явная проверка даёт читаемый ответ)
  IF EXISTS (
    SELECT 1 FROM public.user_achievements
    WHERE user_id = v_user_id AND achievement_id = p_achievement_id
  ) THEN
    RETURN json_build_object('success', false, 'message', 'already_claimed');
  END IF;

  -- ── Проверка условий конкретной ачивки ──────────────────────

  IF p_achievement_id = 'fill_profile' THEN
    -- Условие: непустой bio И username не является дефолтным значением
    IF v_bio IS NULL OR length(trim(v_bio)) = 0 THEN
      RETURN json_build_object('success', false, 'message', 'condition_not_met_bio');
    END IF;
    IF v_username IS NULL
       OR trim(v_username) = ''
       OR lower(trim(v_username)) = '@user'
       OR lower(trim(v_username)) = 'user' THEN
      RETURN json_build_object('success', false, 'message', 'condition_not_met_username');
    END IF;

  ELSIF p_achievement_id = 'create_5_ideas' THEN
    -- Условие: минимум 5 активных или иммунных идей от пользователя
    SELECT COUNT(*) INTO v_ideas_cnt
    FROM public.ideas
    WHERE author_id = v_user_id
      AND status IN ('active', 'immune');

    IF v_ideas_cnt < 5 THEN
      RETURN json_build_object(
        'success',       false,
        'message',       'condition_not_met_ideas',
        'current_count', v_ideas_cnt
      );
    END IF;

  ELSIF p_achievement_id = 'adv_repost' THEN
    -- Условие: есть хотя бы одна одобренная заявка на репост
    SELECT EXISTS (
      SELECT 1 FROM public.repost_claims
      WHERE user_id = v_user_id AND status = 'approved'
    ) INTO v_has_repost;

    IF NOT v_has_repost THEN
      RETURN json_build_object('success', false, 'message', 'condition_not_met_repost');
    END IF;

  ELSE
    RETURN json_build_object('success', false, 'message', 'unknown_achievement');
  END IF;

  -- ── Всё проверено — начисляем награду ───────────────────────

  -- Атомарно обновляем баланс
  UPDATE public.profiles
  SET spk_balance = spk_balance + v_reward
  WHERE id = v_user_id
  RETURNING spk_balance INTO v_balance;

  -- Фиксируем получение ачивки (ON CONFLICT — финальная страховка от дублей)
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (v_user_id, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  RETURN json_build_object(
    'success',     true,
    'new_balance', v_balance,
    'reward',      v_reward
  );

EXCEPTION
  -- Перехватываем гонку (два параллельных вызова пробили явную проверку выше)
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'message', 'already_claimed');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'internal_error');
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_achievement(TEXT) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 5. RPC: get_achievements_status — статус всех ачивок пользователя
--    Возвращает одним запросом всё, что нужно фронту для рендера
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_achievements_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_bio            TEXT;
  v_username       TEXT;
  v_ideas_cnt      BIGINT;
  v_last_repost_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'auth_required');
  END IF;

  -- Профиль
  SELECT bio, username INTO v_bio, v_username
  FROM public.profiles
  WHERE id = v_user_id;

  -- Количество активных идей
  SELECT COUNT(*) INTO v_ideas_cnt
  FROM public.ideas
  WHERE author_id = v_user_id
    AND status IN ('active', 'immune');

  -- Время последней заявки на репост (для rate limit на клиенте/сервере)
  SELECT MAX(created_at) INTO v_last_repost_at
  FROM public.repost_claims
  WHERE user_id = v_user_id;

  RETURN json_build_object(
    'success', true,
    'data', json_build_object(
      -- Прогресс условий
      'ideas_count',         v_ideas_cnt,
      'profile_filled',      (
        v_bio IS NOT NULL
        AND length(trim(v_bio)) > 0
        AND v_username IS NOT NULL
        AND lower(trim(v_username)) NOT IN ('@user', 'user', '')
      ),
      'has_approved_repost', EXISTS (
        SELECT 1 FROM public.repost_claims
        WHERE user_id = v_user_id AND status = 'approved'
      ),
      'last_repost_claim_at', v_last_repost_at,
      -- Уже полученные ачивки
      'claimed_ids',         COALESCE(
        (SELECT json_agg(achievement_id ORDER BY claimed_at)
         FROM public.user_achievements
         WHERE user_id = v_user_id),
        '[]'::json
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_achievements_status() TO authenticated;


-- ──────────────────────────────────────────────────────────
-- Проверка результата (выполняется после миграции)
-- ──────────────────────────────────────────────────────────
SELECT 'table: achievements'         AS check_name, table_name, 'OK' AS status
  FROM information_schema.tables WHERE table_name = 'achievements'        AND table_schema = 'public'
UNION ALL
SELECT 'table: user_achievements',    table_name, 'OK'
  FROM information_schema.tables WHERE table_name = 'user_achievements'   AND table_schema = 'public'
UNION ALL
SELECT 'table: repost_claims',        table_name, 'OK'
  FROM information_schema.tables WHERE table_name = 'repost_claims'       AND table_schema = 'public'
UNION ALL
SELECT 'fn: claim_achievement',       routine_name, 'OK'
  FROM information_schema.routines WHERE routine_name = 'claim_achievement'       AND routine_schema = 'public'
UNION ALL
SELECT 'fn: get_achievements_status', routine_name, 'OK'
  FROM information_schema.routines WHERE routine_name = 'get_achievements_status' AND routine_schema = 'public';
