-- ============================================================
-- SPARK — ICC: награды бета-тестерам (BETA TESTER / PRO + SPK)
-- Миграция: 20260612100000_icc_beta_rewards.sql
-- Запускай ВСЁ сразу одной кнопкой RUN (F5) в Supabase SQL Editor
--
-- Идемпотентность: SPK начисляется только при ПЕРВОЙ вставке
-- ачивки в user_achievements (CTE ниже), бейдж добавляется в
-- special_badges только если его там ещё нет (@> проверка).
-- Повторный запуск ничего не дублирует.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 0. Ослабляем check-констрейнт reward_spk: > 0 → >= 0.
--    Каталожные записи бейджей несут reward_spk = 0, т.к. SPK
--    начисляется отдельно и суммы различаются по участникам.
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.achievements
  DROP CONSTRAINT IF EXISTS achievements_reward_spk_check;
ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_reward_spk_check CHECK (reward_spk >= 0);


-- ──────────────────────────────────────────────────────────
-- 1. Колонка special_badges в profiles
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS special_badges JSONB NOT NULL DEFAULT '[]'::jsonb;


-- ──────────────────────────────────────────────────────────
-- 2. Справочник achievements: записи бейджей
--    (SPK начисляется отдельно ниже, поэтому reward_spk = 0)
-- ──────────────────────────────────────────────────────────
INSERT INTO public.achievements (id, rank, title, description, reward_spk) VALUES
  ('beta_tester',     1, 'BETA TESTER',     'Участник закрытого бета-тестирования SPARK (ICC)', 0),
  ('beta_tester_pro', 1, 'BETA TESTER PRO', 'Топ-участник ICC — «Мега круто»',                  0)
ON CONFLICT (id, rank) DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- 3. Ачивка + начисление SPK одной операцией.
--    SPK получает только тот, кому ачивка вставилась впервые —
--    повторный запуск не начислит баланс второй раз.
-- ──────────────────────────────────────────────────────────
WITH rewards(user_id, achievement_id, spk) AS (
  VALUES
    ('b88dfdd0-75a6-498a-949b-6d5f812b0a64'::uuid, 'beta_tester',     500), -- PoMe1lo (круто)
    ('12d39a8f-12e9-4c69-905e-523dbaa6a888'::uuid, 'beta_tester',     500), -- nori1n (круто)
    ('7ca034e5-6b20-40ff-b142-8fb7b547f0e3'::uuid, 'beta_tester_pro', 750), -- Wolffe104_fj (мега круто)
    ('ee8bfc58-33bb-4630-b330-3c6d78c983de'::uuid, 'beta_tester',     250), -- Dan (норм)
    ('eefc0206-29d0-4adb-865a-2971efe44845'::uuid, 'beta_tester',     250), -- Myr (норм)
    ('3c4a0341-afcd-411a-a3ec-bf4551b25f5a'::uuid, 'beta_tester',     500), -- Bustis (круто)
    ('5b81fe20-ff5f-4214-90b5-15e056be901a'::uuid, 'beta_tester',     500)  -- maymay (круто)
),
ins AS (
  INSERT INTO public.user_achievements (user_id, achievement_id, rank)
  SELECT user_id, achievement_id, 1 FROM rewards
  ON CONFLICT (user_id, achievement_id, rank) DO NOTHING
  RETURNING user_id, achievement_id
)
UPDATE public.profiles p
SET spk_balance = COALESCE(p.spk_balance, 0) + r.spk
FROM rewards r
JOIN ins i
  ON i.user_id = r.user_id
 AND i.achievement_id = r.achievement_id
WHERE p.id = r.user_id;


-- ──────────────────────────────────────────────────────────
-- 4. Бейджи в special_badges (append, без перезаписи чужих
--    бейджей; пропуск, если бейдж уже есть)
-- ──────────────────────────────────────────────────────────

-- BETA TESTER PRO — Wolffe104_fj
UPDATE public.profiles
SET special_badges = COALESCE(special_badges, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object(
    'id',         'beta_tester_pro',
    'label',      'BETA TESTER PRO',
    'color',      '#A78BFA',
    'granted_at', now()
  )
)
WHERE id = '7ca034e5-6b20-40ff-b142-8fb7b547f0e3'
  AND NOT COALESCE(special_badges, '[]'::jsonb) @> '[{"id":"beta_tester_pro"}]'::jsonb;

-- BETA TESTER — остальные 6 участников
UPDATE public.profiles
SET special_badges = COALESCE(special_badges, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object(
    'id',         'beta_tester',
    'label',      'BETA TESTER',
    'color',      '#60A5FA',
    'granted_at', now()
  )
)
WHERE id IN (
  'b88dfdd0-75a6-498a-949b-6d5f812b0a64',  -- PoMe1lo
  '12d39a8f-12e9-4c69-905e-523dbaa6a888',  -- nori1n
  'ee8bfc58-33bb-4630-b330-3c6d78c983de',  -- Dan
  'eefc0206-29d0-4adb-865a-2971efe44845',  -- Myr
  '3c4a0341-afcd-411a-a3ec-bf4551b25f5a',  -- Bustis
  '5b81fe20-ff5f-4214-90b5-15e056be901a'   -- maymay
)
  AND NOT COALESCE(special_badges, '[]'::jsonb) @> '[{"id":"beta_tester"}]'::jsonb;


-- ──────────────────────────────────────────────────────────
-- Проверка результата: должно вернуть 7 строк
-- ──────────────────────────────────────────────────────────
SELECT
  p.username,
  p.spk_balance,
  p.special_badges,
  ua.achievement_id
FROM public.profiles p
LEFT JOIN public.user_achievements ua
  ON ua.user_id = p.id
  AND ua.achievement_id IN ('beta_tester', 'beta_tester_pro')
WHERE p.id IN (
  'b88dfdd0-75a6-498a-949b-6d5f812b0a64',
  '12d39a8f-12e9-4c69-905e-523dbaa6a888',
  '7ca034e5-6b20-40ff-b142-8fb7b547f0e3',
  'ee8bfc58-33bb-4630-b330-3c6d78c983de',
  'eefc0206-29d0-4adb-865a-2971efe44845',
  '3c4a0341-afcd-411a-a3ec-bf4551b25f5a',
  '5b81fe20-ff5f-4214-90b5-15e056be901a'
)
ORDER BY p.username;
