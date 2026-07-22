-- Add premium subscription fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS premium_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.premium_active IS 'Whether user has active premium subscription';
COMMENT ON COLUMN public.profiles.premium_expires_at IS 'Expiration date of premium subscription';
