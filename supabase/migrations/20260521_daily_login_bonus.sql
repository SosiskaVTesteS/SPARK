-- 1. Добавляем колонку last_daily_bonus_claim в profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_bonus_claim timestamptz;

-- 2. Создаем функцию для безопасного получения ежедневного бонуса
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_last_claim timestamptz;
  v_balance numeric;
BEGIN
  -- Получаем ID текущего авторизованного пользователя
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  -- Блокируем строку профиля для предотвращения race conditions (двойных кликов)
  SELECT spk_balance, last_daily_bonus_claim INTO v_balance, v_last_claim
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  -- Проверяем, получен ли бонус сегодня.
  -- Сброс происходит в полночь по UTC.
  IF v_last_claim IS NULL OR date_trunc('day', v_last_claim AT TIME ZONE 'UTC') < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
    -- Начисляем 10 SPK и обновляем дату
    UPDATE public.profiles
    SET 
      spk_balance = spk_balance + 10,
      last_daily_bonus_claim = now()
    WHERE id = v_user_id
    RETURNING spk_balance INTO v_balance;

    RETURN json_build_object(
      'success', true,
      'new_balance', v_balance,
      'amount', 10
    );
  ELSE
    -- Бонус уже получен
    RETURN json_build_object(
      'success', false,
      'new_balance', v_balance,
      'message', 'already_claimed'
    );
  END IF;
END;
$$;
