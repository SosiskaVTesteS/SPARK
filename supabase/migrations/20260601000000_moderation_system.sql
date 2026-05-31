-- ============================================================
-- SPARK — Миграция системы модерации «ИИ → Люди → ИИ»
-- Вставить и выполнить в: Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/ppehttbtrlavnrytoweu/sql
-- ============================================================
-- Запускай ВСЁ сразу одной кнопкой RUN (F5)
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- ЭТАП 2: Поля модерации в таблице ideas
-- ──────────────────────────────────────────────────────────

-- Добавляем счётчик репортов (если нет)
ALTER TABLE ideas
  ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0;

-- Добавляем статус поста (если нет)
-- active  — нормальный, виден в ленте
-- hidden  — скрыт (3+ репорта), ждёт ИИ-судью
-- banned  — удалён финальным ИИ
-- immune  — защищён ИИ, репорты игнорируются
ALTER TABLE ideas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'hidden', 'banned', 'immune'));

-- Индекс для быстрой фильтрации ленты
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);


-- ──────────────────────────────────────────────────────────
-- ЭТАП 2: Таблица жалоб (reports)
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id           UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  reporter_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Один пользователь — одна жалоба на один пост
  UNIQUE (idea_id, reporter_user_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_reports_idea_id ON reports(idea_id);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Авторизованный пользователь может пожаловаться
CREATE POLICY "User can submit report" ON reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

-- Читать свои жалобы (чтобы фронт знал, жаловался ли уже)
CREATE POLICY "User can read own reports" ON reports
  FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());


-- ──────────────────────────────────────────────────────────
-- ЭТАП 3: Очередь модерации (moderation_queue)
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS moderation_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id       UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  queued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  verdict       TEXT CHECK (verdict IN ('BAN', 'ALLOW')),
  ai_reasoning  TEXT,

  UNIQUE (idea_id)  -- один пост — одна запись в очереди
);

CREATE INDEX IF NOT EXISTS idx_modqueue_processed ON moderation_queue(processed_at)
  WHERE processed_at IS NULL;  -- быстрый поиск необработанных


-- ──────────────────────────────────────────────────────────
-- ЭТАП 3: Архив забаненных постов (banned_posts)
-- Хранится для ручной апелляции, даже если идея удалена
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS banned_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id        UUID,                          -- может стать NULL если идея удалена
  original_text  TEXT NOT NULL,
  author_user_id UUID,
  banned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_reasoning   TEXT
);


-- ──────────────────────────────────────────────────────────
-- ЭТАП 5: Лог всех решений ИИ (moderation_log)
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS moderation_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id     UUID REFERENCES ideas(id) ON DELETE SET NULL,
  stage       TEXT NOT NULL CHECK (stage IN ('openai_filter', 'gemini_judge')),
  verdict     TEXT NOT NULL,   -- 'allowed', 'blocked', 'BAN', 'ALLOW'
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modlog_idea_id ON moderation_log(idea_id);
CREATE INDEX IF NOT EXISTS idx_modlog_created ON moderation_log(created_at DESC);


-- ──────────────────────────────────────────────────────────
-- RPC: submit_report — вызывается с фронта вместо Edge Function
-- Использует SECURITY DEFINER чтобы обойти RLS при UPDATE ideas
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION submit_report(p_idea_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idea        ideas%ROWTYPE;
  v_already     BOOLEAN;
  v_new_count   INT;
BEGIN
  -- Проверяем авторизацию
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Получаем пост
  SELECT * INTO v_idea FROM ideas WHERE id = p_idea_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'idea_not_found');
  END IF;

  -- Иммунитет — репорт игнорируем
  IF v_idea.status = 'immune' THEN
    RETURN jsonb_build_object('error', 'post_is_immune');
  END IF;

  -- Уже забанен/скрыт — нет смысла
  IF v_idea.status IN ('banned', 'hidden') THEN
    RETURN jsonb_build_object('error', 'post_already_moderated');
  END IF;

  -- Проверяем, не жаловался ли этот юзер уже
  SELECT EXISTS(
    SELECT 1 FROM reports
    WHERE idea_id = p_idea_id AND reporter_user_id = auth.uid()
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('error', 'already_reported');
  END IF;

  -- Вставляем жалобу
  INSERT INTO reports (idea_id, reporter_user_id)
  VALUES (p_idea_id, auth.uid());

  -- Инкрементируем счётчик
  UPDATE ideas
  SET report_count = report_count + 1
  WHERE id = p_idea_id
  RETURNING report_count INTO v_new_count;

  -- Порог: 3 жалобы → скрываем и ставим в очередь
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

-- Права на вызов
GRANT EXECUTE ON FUNCTION submit_report(UUID) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- Проверка результата
-- ──────────────────────────────────────────────────────────

SELECT
  'ideas.status'    AS check_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ideas' AND column_name IN ('status', 'report_count')
UNION ALL
SELECT 'table: reports',         table_name, 'OK' FROM information_schema.tables WHERE table_name = 'reports'
UNION ALL
SELECT 'table: moderation_queue', table_name, 'OK' FROM information_schema.tables WHERE table_name = 'moderation_queue'
UNION ALL
SELECT 'table: banned_posts',     table_name, 'OK' FROM information_schema.tables WHERE table_name = 'banned_posts'
UNION ALL
SELECT 'table: moderation_log',   table_name, 'OK' FROM information_schema.tables WHERE table_name = 'moderation_log'
UNION ALL
SELECT 'fn: submit_report',       routine_name, 'OK' FROM information_schema.routines WHERE routine_name = 'submit_report';
