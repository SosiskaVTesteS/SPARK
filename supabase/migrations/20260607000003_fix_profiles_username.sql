-- Migration: 20260607000003_fix_profiles_username.sql
-- Add username column to public.profiles if missing.
-- chats-engine.js queries .ilike('username', ...) which fails when the
-- column does not exist, breaking the user-search DM creation flow.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Backfill existing rows using the email prefix from auth.users.
-- ON CONFLICT DO NOTHING keeps any username already set.
UPDATE public.profiles p
SET username = SPLIT_PART(u.email, '@', 1)
FROM auth.users u
WHERE p.id = u.id
  AND p.username IS NULL;
