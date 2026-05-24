-- Migration: Add DELETE policy and ensure messages are in the realtime publication
CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- Ensure replica identity is set to DEFAULT or FULL to track deletes properly
ALTER TABLE public.messages REPLICA IDENTITY DEFAULT;

COMMIT;
