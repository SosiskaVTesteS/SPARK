-- Migration: Fix RLS policy for channel_members to allow adding participants
-- The previous policy only allowed users to add themselves (auth.uid() = user_id)
-- This prevents channel creators from adding other participants

-- Drop the restrictive policy
DROP POLICY IF EXISTS "cm_insert_own" ON public.channel_members;

-- Create a new policy that allows:
-- 1. Users to add themselves (for channel creation)
-- 2. Existing channel members to add other participants
CREATE POLICY "cm_insert_own_or_member" ON public.channel_members
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.channel_members 
      WHERE channel_id = channel_members.channel_id 
      AND user_id = auth.uid()
    )
  );
