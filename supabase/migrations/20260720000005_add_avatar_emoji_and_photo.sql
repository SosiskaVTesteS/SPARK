-- Add avatar_emoji and avatar_photo columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_emoji TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS avatar_photo TEXT DEFAULT '';
