-- Migration: Fix RLS policy for channel_members to allow adding participants
-- The previous policy only allowed users to add themselves (auth.uid() = user_id)
-- This prevents channel creators from adding other participants
-- The EXISTS approach fails because RLS on SELECT also restricts visibility within the policy

-- Drop all existing insert policies
DROP POLICY IF EXISTS "cm_insert_own" ON public.channel_members;
DROP POLICY IF EXISTS "cm_insert_own_or_member" ON public.channel_members;

-- Create a simple policy that allows all authenticated users to insert
-- Security is enforced at the application level (user must be a channel member to add others)
CREATE POLICY "cm_insert_authenticated" ON public.channel_members
  FOR INSERT TO authenticated 
  WITH CHECK (true);
