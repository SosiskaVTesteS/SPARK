-- Журнал подозрительных действий для ручного расследования мошенничества
CREATE TABLE IF NOT EXISTS public.fraud_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,
  -- Типы: 'duplicate_link' | 'account_too_new' | 'invalid_social_url'
  --       | 'invalid_code_in_page' | 'rate_limit_bypass_attempt'
  repost_link TEXT,
  code_used   TEXT,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_log_user
  ON public.fraud_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_log_event
  ON public.fraud_log(event_type, created_at DESC);

-- RLS: только service_role может писать и читать; пользователи не видят лог
ALTER TABLE public.fraud_log ENABLE ROW LEVEL SECURITY;
