-- Migration: Fix RLS policies for messages table
-- Current policies are too permissive (USING true for SELECT and UPDATE)
-- New policies restrict access to messages where user is a channel member or sender

-- Create SECURITY DEFINER function to check if user can access a channel's messages
CREATE OR REPLACE FUNCTION public.can_access_channel_messages(p_channel_id TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- User can access messages if:
  -- 1. They are the sender of the message (checked separately in policy)
  -- 2. They are a member of the channel
  RETURN EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id
    AND user_id = p_user_id
  );
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Messages are viewable by authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own reactions on messages" ON public.messages;

-- Create proper SELECT policy
-- Users can see messages where they are the sender OR they are a channel member
CREATE POLICY "messages_select_own_or_channel_member" ON public.messages
  FOR SELECT TO authenticated 
  USING (
    auth.uid() = sender_id OR
    public.can_access_channel_messages(channel_id, auth.uid())
  );

-- Create proper INSERT policy
-- Users can insert messages if they are authenticated (channel membership checked at app level)
CREATE POLICY "messages_insert_authenticated" ON public.messages
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = sender_id);

-- Create proper UPDATE policy
-- Users can update only their own messages
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE TO authenticated 
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Create DELETE policy
-- Users can delete only their own messages
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE TO authenticated 
  USING (auth.uid() = sender_id);
