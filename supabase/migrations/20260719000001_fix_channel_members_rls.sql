-- Migration: Fix RLS policy for channel_members to allow adding participants
-- The previous policy only allowed users to add themselves (auth.uid() = user_id)
-- This prevents channel creators from adding other participants
-- The EXISTS approach fails because RLS on SELECT also restricts visibility within the policy
-- Solution: Use a SECURITY DEFINER function to bypass RLS for the membership check

-- Drop all existing insert policies
DROP POLICY IF EXISTS "cm_insert_own" ON public.channel_members;
DROP POLICY IF EXISTS "cm_insert_own_or_member" ON public.channel_members;
DROP POLICY IF EXISTS "cm_insert_authenticated" ON public.channel_members;

-- Create a SECURITY DEFINER function to check if user is a channel member
-- This function bypasses RLS for the SELECT, but the logic is hardcoded and safe
CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel_id TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id
    AND user_id = p_user_id
  );
END;
$$;

-- Create a proper RLS policy that allows:
-- 1. Users to add themselves (for channel creation)
-- 2. Existing channel members to add other participants
CREATE POLICY "cm_insert_own_or_member" ON public.channel_members
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() = user_id OR 
    public.is_channel_member(channel_id, auth.uid())
  );

-- Also update SELECT policy to allow users to see channels they are members of
DROP POLICY IF EXISTS "cm_select_own" ON public.channel_members;
CREATE POLICY "cm_select_own" ON public.channel_members
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);
