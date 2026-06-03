-- ============================================================
-- SPARK — Система рангов достижений (I → V)
-- Миграция: 20260603_achievement_ranks.sql
-- Запускай ВСЁ сразу одной кнопкой RUN (F5) в Supabase SQL Editor
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. Расширяем таблицу achievements — добавляем колонку rank
-- ──────────────────────────────────────────────────────────

-- Снимаем FK из user_achievements ДО изменения PK в achievements
ALTER TABLE public.user_achievements
  DROP CONSTRAINT IF EXISTS user_achievements_achievement_id_fkey;

-- Добавляем rank со значением по умолчанию 1 (все старые записи становятся рангом I)
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS rank INT NOT NULL DEFAULT 1;

-- Меняем PRIMARY KEY: TEXT → составной (id, rank)
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_pkey;
ALTER TABLE public.achievements ADD PRIMARY KEY (id, rank);

-- Вставляем все 15 рангов (ранг 1 для fill_profile и adv_repost уже есть — пропускаем)
INSERT INTO public.achievements (id, rank, title, description, reward_spk) VALUES
  -- fill_profile
  ('fill_profile', 1, 'Заполненный профиль I',   'Укажи уникальный никнейм и заполни Bio',              100),
  ('fill_profile', 2, 'Заполненный профиль II',  'Bio длиннее 50 символов и аватар не по умолчанию',    150),
  ('fill_profile', 3, 'Заполненный профиль III', 'Bio длиннее 100 символов',                            200),
  ('fill_profile', 4, 'Заполненный профиль IV',  'В bio есть ссылка на сайт или соцсеть',               300),
  ('fill_profile', 5, 'Заполненный профиль V',   'Профиль мастера SPARK — bio заполнен до максимума',   500),
  -- create_ideas (новая серия рангов; create_5_ideas сохраняется как легаси)
  ('create_ideas', 1, 'Генератор стартапов I',   'Опубликуй 5 идей',                                    100),
  ('create_ideas', 2, 'Генератор стартапов II',  'Опубликуй 15 идей',                                   200),
  ('create_ideas', 3, 'Генератор стартапов III', 'Опубликуй 30 идей',                                   350),
  ('create_ideas', 4, 'Генератор стартапов IV',  'Опубликуй 60 идей',                                   500),
  ('create_ideas', 5, 'Генератор стартапов V',   'Опубликуй 100 идей',                                 1000),
  -- adv_repost
  ('adv_repost',   1, 'Амбассадор SPARK I',      'Подтверждённый репост о SPARK',                        50),
  ('adv_repost',   2, 'Амбассадор SPARK II',     '3 подтверждённых репоста',                            100),
  ('adv_repost',   3, 'Амбассадор SPARK III',    '7 подтверждённых репостов',                           200),
  ('adv_repost',   4, 'Амбассадор SPARK IV',     '15 подтверждённых репостов',                          350),
  ('adv_repost',   5, 'Амбассадор SPARK V',      '30 подтверждённых репостов',                          500)
ON CONFLICT (id, rank) DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- 2. Расширяем таблицу user_achievements — добавляем rank
-- ──────────────────────────────────────────────────────────

-- Добавляем rank (DEFAULT 1 — все существующие записи автоматически становятся рангом I)
ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS rank INT NOT NULL DEFAULT 1;

-- Меняем UNIQUE constraint: теперь уникальность по тройке (user_id, achievement_id, rank)
ALTER TABLE public.user_achievements
  DROP CONSTRAINT IF EXISTS user_achievements_user_id_achievement_id_key;
ALTER TABLE public.user_achievements
  ADD CONSTRAINT user_achievements_unique
  UNIQUE (user_id, achievement_id, rank);

-- Восстанавливаем FK как составной: (achievement_id, rank) → achievements(id, rank)
ALTER TABLE public.user_achievements
  ADD CONSTRAINT user_achievements_ach_rank_fkey
  FOREIGN KEY (achievement_id, rank)
  REFERENCES public.achievements(id, rank);


-- ──────────────────────────────────────────────────────────
-- 3. RPC: claim_achievement_rank — получение конкретного ранга
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_achievement_rank(
  p_achievement_id TEXT,
  p_rank           INT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_balance      NUMERIC;
  v_reward       INT;
  v_bio          TEXT;
  v_username     TEXT;
  v_avatar_color SMALLINT;
  v_ideas_cnt    BIGINT;
  v_repost_cnt   BIGINT;
  v_threshold    INT;
  v_next_reward  INT;
BEGIN
  -- Авторизация
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'auth_required');
  END IF;

  IF p_rank < 1 OR p_rank > 5 THEN
    RETURN json_build_object('success', false, 'message', 'invalid_rank');
  END IF;

  -- Проверяем, что такая ачивка + ранг существует
  SELECT reward_spk INTO v_reward
  FROM public.achievements
  WHERE id = p_achievement_id AND rank = p_rank;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'achievement_not_found');
  END IF;

  -- Нельзя пропускать ранги: предыдущий должен быть уже получен
  IF p_rank > 1 AND NOT EXISTS (
    SELECT 1 FROM public.user_achievements
    WHERE user_id = v_user_id
      AND achievement_id = p_achievement_id
      AND rank = p_rank - 1
  ) THEN
    RETURN json_build_object('success', false, 'message', 'previous_rank_required');
  END IF;

  -- Блокируем строку профиля (FOR UPDATE — защита от race conditions)
  SELECT spk_balance, bio, username, avatar_color
  INTO v_balance, v_bio, v_username, v_avatar_color
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'profile_not_found');
  END IF;

  -- Явная проверка дубля
  IF EXISTS (
    SELECT 1 FROM public.user_achievements
    WHERE user_id = v_user_id
      AND achievement_id = p_achievement_id
      AND rank = p_rank
  ) THEN
    RETURN json_build_object('success', false, 'message', 'already_claimed');
  END IF;

  -- ── Проверка условий ────────────────────────────────────

  IF p_achievement_id = 'fill_profile' THEN

    IF p_rank = 1 THEN
      IF v_bio IS NULL OR length(trim(v_bio)) = 0 THEN
        RETURN json_build_object('success', false, 'message', 'condition_not_met_bio');
      END IF;
      IF v_username IS NULL OR lower(trim(v_username)) IN ('@user', 'user', '') THEN
        RETURN json_build_object('success', false, 'message', 'condition_not_met_username');
      END IF;

    ELSIF p_rank = 2 THEN
      IF v_bio IS NULL OR length(v_bio) <= 50 THEN
        RETURN json_build_object('success', false, 'message', 'condition_not_met_bio_length',
          'current_length', COALESCE(length(v_bio), 0), 'required', 51);
      END IF;
      IF COALESCE(v_avatar_color, 0) = 0 THEN
        RETURN json_build_object('success', false, 'message', 'condition_not_met_avatar');
      END IF;

    ELSIF p_rank = 3 THEN
      IF v_bio IS NULL OR length(v_bio) <= 100 THEN
        RETURN json_build_object('success', false, 'message', 'condition_not_met_bio_length',
          'current_length', COALESCE(length(v_bio), 0), 'required', 101);
      END IF;

    ELSIF p_rank = 4 THEN
      IF v_bio IS NULL OR (
        v_bio NOT LIKE '%https://%'
        AND v_bio NOT LIKE '%t.me%'
        AND v_bio NOT LIKE '%vk.com%'
      ) THEN
        RETURN json_build_object('success', false, 'message', 'condition_not_met_bio_link');
      END IF;

    ELSIF p_rank = 5 THEN
      -- Максимальная длина bio = 160 символов (см. миграцию 20260523000000)
      IF v_bio IS NULL OR length(v_bio) < 160 THEN
        RETURN json_build_object('success', false, 'message', 'condition_not_met_bio_max',
          'current_length', COALESCE(length(v_bio), 0), 'required', 160);
      END IF;
    END IF;

  ELSIF p_achievement_id = 'create_ideas' THEN

    SELECT COUNT(*) INTO v_ideas_cnt
    FROM public.ideas
    WHERE author_id = v_user_id AND status IN ('active', 'immune');

    v_threshold := CASE p_rank
      WHEN 1 THEN 5
      WHEN 2 THEN 15
      WHEN 3 THEN 30
      WHEN 4 THEN 60
      ELSE       100
    END;

    IF v_ideas_cnt < v_threshold THEN
      RETURN json_build_object(
        'success', false,
        'message', 'condition_not_met_ideas',
        'current_count', v_ideas_cnt,
        'required', v_threshold
      );
    END IF;

  ELSIF p_achievement_id = 'adv_repost' THEN

    SELECT COUNT(*) INTO v_repost_cnt
    FROM public.repost_claims
    WHERE user_id = v_user_id AND status = 'approved';

    v_threshold := CASE p_rank
      WHEN 1 THEN 1
      WHEN 2 THEN 3
      WHEN 3 THEN 7
      WHEN 4 THEN 15
      ELSE       30
    END;

    IF v_repost_cnt < v_threshold THEN
      RETURN json_build_object(
        'success', false,
        'message', 'condition_not_met_repost',
        'current_count', v_repost_cnt,
        'required', v_threshold
      );
    END IF;

  ELSE
    RETURN json_build_object('success', false, 'message', 'unknown_achievement');
  END IF;

  -- ── Начисляем награду ────────────────────────────────────

  UPDATE public.profiles
  SET spk_balance = spk_balance + v_reward
  WHERE id = v_user_id
  RETURNING spk_balance INTO v_balance;

  INSERT INTO public.user_achievements (user_id, achievement_id, rank)
  VALUES (v_user_id, p_achievement_id, p_rank)
  ON CONFLICT (user_id, achievement_id, rank) DO NOTHING;

  -- Награда следующего ранга (NULL если уже V)
  SELECT reward_spk INTO v_next_reward
  FROM public.achievements
  WHERE id = p_achievement_id AND rank = p_rank + 1;

  RETURN json_build_object(
    'success',             true,
    'new_balance',         v_balance,
    'reward',              v_reward,
    'rank',                p_rank,
    'next_rank_available', (p_rank < 5),
    'next_rank_reward',    v_next_reward
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'message', 'already_claimed');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'internal_error');
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_achievement_rank(TEXT, INT) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 4. RPC: get_achievements_status — обновлённая версия
--    Добавляет rank_data; сохраняет все легаси-поля для
--    обратной совместимости с уже запущенным фронтом
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_achievements_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID;
  v_bio              TEXT;
  v_username         TEXT;
  v_avatar_color     SMALLINT;
  v_ideas_cnt        BIGINT;
  v_repost_cnt       BIGINT;
  v_last_repost_at   TIMESTAMPTZ;
  v_fp_rank          INT;
  v_ci_rank          INT;
  v_ar_rank          INT;
  v_fp_next_reward   INT;
  v_ci_next_reward   INT;
  v_ar_next_reward   INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'auth_required');
  END IF;

  SELECT bio, username, avatar_color
  INTO v_bio, v_username, v_avatar_color
  FROM public.profiles WHERE id = v_user_id;

  SELECT COUNT(*) INTO v_ideas_cnt
  FROM public.ideas
  WHERE author_id = v_user_id AND status IN ('active', 'immune');

  SELECT COUNT(*) INTO v_repost_cnt
  FROM public.repost_claims
  WHERE user_id = v_user_id AND status = 'approved';

  SELECT MAX(created_at) INTO v_last_repost_at
  FROM public.repost_claims WHERE user_id = v_user_id;

  -- Текущий максимальный ранг по каждой ачивке
  SELECT COALESCE(MAX(rank), 0) INTO v_fp_rank
  FROM public.user_achievements
  WHERE user_id = v_user_id AND achievement_id = 'fill_profile';

  SELECT COALESCE(MAX(rank), 0) INTO v_ci_rank
  FROM public.user_achievements
  WHERE user_id = v_user_id AND achievement_id = 'create_ideas';

  SELECT COALESCE(MAX(rank), 0) INTO v_ar_rank
  FROM public.user_achievements
  WHERE user_id = v_user_id AND achievement_id = 'adv_repost';

  -- Награды следующих рангов
  SELECT reward_spk INTO v_fp_next_reward FROM public.achievements
    WHERE id = 'fill_profile' AND rank = v_fp_rank + 1;
  SELECT reward_spk INTO v_ci_next_reward FROM public.achievements
    WHERE id = 'create_ideas' AND rank = v_ci_rank + 1;
  SELECT reward_spk INTO v_ar_next_reward FROM public.achievements
    WHERE id = 'adv_repost' AND rank = v_ar_rank + 1;

  RETURN json_build_object(
    'success', true,
    'data', json_build_object(
      -- Легаси-поля (фронт продолжает работать без изменений)
      'ideas_count',          v_ideas_cnt,
      'profile_filled',       (
        v_bio IS NOT NULL
        AND length(trim(v_bio)) > 0
        AND v_username IS NOT NULL
        AND lower(trim(v_username)) NOT IN ('@user', 'user', '')
      ),
      'has_approved_repost',  (v_repost_cnt > 0),
      'last_repost_claim_at', v_last_repost_at,
      'claimed_ids', COALESCE(
        (SELECT json_agg(aid) FROM (
          SELECT DISTINCT achievement_id AS aid
          FROM public.user_achievements
          WHERE user_id = v_user_id
        ) t),
        '[]'::json
      ),
      -- Новые данные рангов для обновлённого фронта
      'rank_data', json_build_object(
        'fill_profile', json_build_object(
          'current_rank',     v_fp_rank,
          'next_rank',        CASE WHEN v_fp_rank < 5 THEN v_fp_rank + 1 ELSE NULL END,
          'next_rank_reward', v_fp_next_reward,
          'progress', json_build_object(
            'bio_length',   COALESCE(length(v_bio), 0),
            'has_username', (v_username IS NOT NULL AND lower(trim(v_username)) NOT IN ('@user','user','')),
            'avatar_color', COALESCE(v_avatar_color, 0),
            'threshold',    CASE v_fp_rank + 1
              WHEN 2 THEN 51 WHEN 3 THEN 101 WHEN 4 THEN NULL WHEN 5 THEN 160 ELSE NULL
            END
          )
        ),
        'create_ideas', json_build_object(
          'current_rank',     v_ci_rank,
          'next_rank',        CASE WHEN v_ci_rank < 5 THEN v_ci_rank + 1 ELSE NULL END,
          'next_rank_reward', v_ci_next_reward,
          'progress', json_build_object(
            'ideas_count', v_ideas_cnt,
            'threshold',   CASE v_ci_rank + 1
              WHEN 1 THEN 5 WHEN 2 THEN 15 WHEN 3 THEN 30 WHEN 4 THEN 60 WHEN 5 THEN 100
              ELSE NULL
            END
          )
        ),
        'adv_repost', json_build_object(
          'current_rank',     v_ar_rank,
          'next_rank',        CASE WHEN v_ar_rank < 5 THEN v_ar_rank + 1 ELSE NULL END,
          'next_rank_reward', v_ar_next_reward,
          'progress', json_build_object(
            'reposts_count', v_repost_cnt,
            'threshold',     CASE v_ar_rank + 1
              WHEN 1 THEN 1 WHEN 2 THEN 3 WHEN 3 THEN 7 WHEN 4 THEN 15 WHEN 5 THEN 30
              ELSE NULL
            END
          )
        )
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_achievements_status() TO authenticated;


-- ──────────────────────────────────────────────────────────
-- Проверка результата
-- ──────────────────────────────────────────────────────────
SELECT 'col rank in achievements'    AS check_name,
       column_name, data_type, 'OK'  AS status
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'rank'
UNION ALL
SELECT 'col rank in user_achievements',
       column_name, data_type, 'OK'
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'user_achievements' AND column_name = 'rank'
UNION ALL
SELECT 'fn: claim_achievement_rank', routine_name, routine_type, 'OK'
  FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_name = 'claim_achievement_rank'
UNION ALL
SELECT 'fn: get_achievements_status', routine_name, routine_type, 'OK'
  FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_name = 'get_achievements_status'
UNION ALL
SELECT 'achievements rows', CAST(COUNT(*) AS TEXT), 'rows', 'OK'
  FROM public.achievements;
