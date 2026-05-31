-- ============================================================
-- SPARK — Авто-запуск Кибер-Судьи через pg_cron
-- Вставить в: Supabase Dashboard → SQL Editor → Run
-- Запускается ПОСЛЕ деплоя cyber-judge
-- ============================================================

-- Включаем расширение pg_cron (уже есть в Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Получаем anon key из настроек (нужен для вызова Edge Function)
-- ВАЖНО: подставь свой реальный SUPABASE_ANON_KEY ниже
-- Его можно найти: Dashboard → Project Settings → API → anon public

SELECT cron.schedule(
  'cyber-judge-every-5-min',        -- имя задачи
  '*/5 * * * *',                     -- каждые 5 минут
  $$
  SELECT net.http_post(
    url     := 'https://ppehttbtrlavnrytoweu.supabase.co/functions/v1/cyber-judge',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ВСТАВЬ_ANON_KEY_СЮДА"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Проверка — должна появиться строка 'cyber-judge-every-5-min'
SELECT jobid, schedule, command FROM cron.job WHERE jobname = 'cyber-judge-every-5-min';
