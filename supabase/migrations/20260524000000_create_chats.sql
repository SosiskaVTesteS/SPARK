-- Migration: Create messages table for DMs and Topics with reactions support
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  sender_avatar_color SMALLINT DEFAULT 0 CHECK (sender_avatar_color >= 0 AND sender_avatar_color <= 11),
  content TEXT NOT NULL,
  media_url TEXT,
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Recreate policies to ensure security
DROP POLICY IF EXISTS "Messages are viewable by authenticated users" ON public.messages;
CREATE POLICY "Messages are viewable by authenticated users" ON public.messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their own reactions on messages" ON public.messages;
CREATE POLICY "Users can update their own reactions on messages" ON public.messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

COMMIT;
