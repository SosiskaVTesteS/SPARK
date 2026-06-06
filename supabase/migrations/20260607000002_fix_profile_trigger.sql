-- Migration: 20260607000002_fix_profile_trigger.sql
-- Auto-create a public.profiles row every time a new auth.users row is inserted.
-- Without this, new registrations have no profile, causing 404-like behaviour
-- on profile fetches and NULL username lookups.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, created_at)
  VALUES (
    NEW.id,
    SPLIT_PART(NEW.email, '@', 1),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop then recreate so re-running the migration is safe.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
