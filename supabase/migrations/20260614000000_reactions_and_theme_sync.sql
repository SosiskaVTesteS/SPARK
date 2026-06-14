-- ============================================================
-- SPARK — двусторонняя синхронизация реакций и темы (web ↔ Android)
-- Миграция: 20260614000000_reactions_and_theme_sync.sql
--
-- Что создаём:
--   1. user_reactions  — таблица per-user пиков (1 эмодзи на идею на юзера)
--   2. toggle_reaction — единый atomic RPC для web и Android
--   3. profiles.theme_preset_id — колонка для кросс-девайс синхронизации темы
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. Таблица user_reactions (per-user pick, one emoji per idea)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_reactions (
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea_id  uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  emoji    text NOT NULL,
  PRIMARY KEY (user_id, idea_id)
);

ALTER TABLE public.user_reactions ENABLE ROW LEVEL SECURITY;

-- Пользователь видит и изменяет только свои записи
DROP POLICY IF EXISTS "user_reactions_own" ON public.user_reactions;
CREATE POLICY "user_reactions_own" ON public.user_reactions
  FOR ALL USING (auth.uid() = user_id);

-- Индекс для быстрой выборки всех реакций пользователя
CREATE INDEX IF NOT EXISTS user_reactions_user_id_idx ON public.user_reactions(user_id);

-- ──────────────────────────────────────────────────────────
-- 2. Единый RPC toggle_reaction (используется web + Android)
--    Атомарно:
--      - Снимает предыдущий pick (если был другой эмодзи)
--      - Ставит новый pick (или убирает, если тот же эмодзи)
--      - Обновляет ideas.reactions (aggregate counts)
--      - Возвращает { reactions: {...}, pick: emoji|null }
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_reaction(
  p_idea_id uuid,
  p_emoji   text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_old_emoji text;
  v_reactions jsonb;
  v_pick      text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Текущий pick пользователя по этой идее (NULL если нет)
  SELECT emoji INTO v_old_emoji
  FROM public.user_reactions
  WHERE user_id = v_uid AND idea_id = p_idea_id;

  -- Снимаем старый pick + декремент aggregate (если был)
  IF v_old_emoji IS NOT NULL THEN
    UPDATE public.ideas
    SET reactions = jsonb_set(
      COALESCE(reactions, '{}'::jsonb),
      ARRAY[v_old_emoji],
      to_jsonb(GREATEST(0, COALESCE((reactions ->> v_old_emoji)::int, 0) - 1))
    )
    WHERE id = p_idea_id;

    DELETE FROM public.user_reactions
    WHERE user_id = v_uid AND idea_id = p_idea_id;
  END IF;

  -- Ставим новый pick + инкремент aggregate (если это не toggle-off)
  IF v_old_emoji IS DISTINCT FROM p_emoji THEN
    UPDATE public.ideas
    SET reactions = jsonb_set(
      COALESCE(reactions, '{}'::jsonb),
      ARRAY[p_emoji],
      to_jsonb(COALESCE((reactions ->> p_emoji)::int, 0) + 1)
    )
    WHERE id = p_idea_id;

    INSERT INTO public.user_reactions (user_id, idea_id, emoji)
    VALUES (v_uid, p_idea_id, p_emoji)
    ON CONFLICT (user_id, idea_id) DO UPDATE SET emoji = EXCLUDED.emoji;

    v_pick := p_emoji;
  ELSE
    v_pick := NULL; -- toggle-off: убираем реакцию
  END IF;

  -- Возвращаем актуальный aggregate и pick (1:1 формат с Android ToggleResult)
  SELECT reactions INTO v_reactions FROM public.ideas WHERE id = p_idea_id;
  RETURN jsonb_build_object(
    'reactions', COALESCE(v_reactions, '{}'::jsonb),
    'pick',      v_pick
  );
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 3. Колонка theme_preset_id в profiles
--    Хранит id пресета ("cosmos", "ocean", ...) или NULL (кастом / по умолчанию).
--    Позволяет Web и Android синхронизировать выбранную тему через Supabase.
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preset_id text DEFAULT NULL;

-- ──────────────────────────────────────────────────────────
-- Проверка: убеждаемся, что RPC создана и таблица существует
-- ──────────────────────────────────────────────────────────
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'toggle_reaction';

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'theme_preset_id';