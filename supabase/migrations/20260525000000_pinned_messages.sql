-- Migration: Add pinned messages table and conversation deletion RPC
CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  for_everyone BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

-- Recreate policies to ensure security
DROP POLICY IF EXISTS "Pinned messages are viewable by authenticated users" ON public.pinned_messages;
CREATE POLICY "Pinned messages are viewable by authenticated users" ON public.pinned_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can pin messages" ON public.pinned_messages;
CREATE POLICY "Authenticated users can pin messages" ON public.pinned_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = pinned_by);

DROP POLICY IF EXISTS "Pinner can unpin messages" ON public.pinned_messages;
CREATE POLICY "Pinner can unpin messages" ON public.pinned_messages
  FOR DELETE TO authenticated USING (auth.uid() = pinned_by);

-- Ensure replica identity is set to FULL
ALTER TABLE public.pinned_messages REPLICA IDENTITY FULL;

-- Try to add table to realtime publication if exists, or recreate it
-- Note: In standard Supabase, we can use:
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_messages;

-- Create secure RPC function to delete conversations for everyone
CREATE OR REPLACE FUNCTION public.delete_conversation(target_channel TEXT, delete_for_everyone BOOLEAN)
RETURNS void AS $$
BEGIN
  IF delete_for_everyone THEN
    -- Delete all messages in the DM conversation between auth.uid() and target_channel
    DELETE FROM public.messages
    WHERE (sender_id = auth.uid() AND channel_id = target_channel)
       OR (sender_id::text = target_channel AND channel_id = auth.uid()::text)
       OR (channel_id = target_channel); -- also support topics if target_channel matches topic id
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
