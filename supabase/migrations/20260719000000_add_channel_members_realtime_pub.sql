-- Migration: Add channel_members table to Supabase realtime publication
-- This enables realtime sync for team channels across devices
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
