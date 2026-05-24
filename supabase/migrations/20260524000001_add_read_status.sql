-- Migration: Add read status column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

COMMIT;
