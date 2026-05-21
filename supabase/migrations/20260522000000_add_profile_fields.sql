-- Migration: add bio and avatar_color columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio TEXT CHECK (char_length(bio) <= 120),
  ADD COLUMN IF NOT EXISTS avatar_color SMALLINT DEFAULT 0
    CHECK (avatar_color >= 0 AND avatar_color <= 11);
