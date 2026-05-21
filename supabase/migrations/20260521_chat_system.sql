-- 1. Create chat_rooms table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create chat_participants table
CREATE TABLE IF NOT EXISTS public.chat_participants (
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- 3. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Add table to realtime publication (so frontend can subscribe to postgres_changes)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.chat_messages;
COMMIT;

-- RLS for chat_rooms: User can select a room if they are a participant
CREATE POLICY "Users can view rooms they are in" ON public.chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp 
      WHERE cp.room_id = chat_rooms.id AND cp.user_id = auth.uid()
    )
  );

-- RLS for chat_participants: User can select participants of rooms they are in
CREATE POLICY "Users can view participants of their rooms" ON public.chat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants my_cp
      WHERE my_cp.room_id = chat_participants.room_id AND my_cp.user_id = auth.uid()
    )
  );

-- RLS for chat_messages: Read and Insert if participant
CREATE POLICY "Users can read messages in their rooms" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp 
      WHERE cp.room_id = chat_messages.room_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their rooms" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp 
      WHERE cp.room_id = room_id AND cp.user_id = auth.uid()
    ) AND sender_id = auth.uid()
  );

-- RPC: create_direct_chat(target_user_id)
CREATE OR REPLACE FUNCTION public.create_direct_chat(target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_room_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF v_user_id = target_user_id THEN
    RAISE EXCEPTION 'cannot_chat_with_self';
  END IF;

  -- Check if direct chat already exists
  SELECT r.id INTO v_room_id
  FROM public.chat_rooms r
  JOIN public.chat_participants p1 ON p1.room_id = r.id AND p1.user_id = v_user_id
  JOIN public.chat_participants p2 ON p2.room_id = r.id AND p2.user_id = target_user_id
  WHERE r.type = 'direct'
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  -- Create new room
  INSERT INTO public.chat_rooms (type) VALUES ('direct') RETURNING id INTO v_room_id;

  -- Add participants
  INSERT INTO public.chat_participants (room_id, user_id) VALUES 
    (v_room_id, v_user_id),
    (v_room_id, target_user_id);

  RETURN v_room_id;
END;
$$;

-- RPC: get_user_chats()
-- Returns list of rooms with last message, unread count, and partner info for direct chats
CREATE OR REPLACE FUNCTION public.get_user_chats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) INTO v_result
  FROM (
    SELECT 
      cr.id,
      cr.type,
      cr.name,
      cr.created_at,
      cp.last_read_at,
      -- Get partner for direct chats
      (
        SELECT json_build_object('id', p.id, 'username', p.username)
        FROM public.chat_participants other_cp
        JOIN public.profiles p ON p.id = other_cp.user_id
        WHERE other_cp.room_id = cr.id AND other_cp.user_id != v_user_id
        LIMIT 1
      ) as partner,
      -- Get last message
      (
        SELECT json_build_object('text', cm.content, 'created_at', cm.created_at, 'sender_id', cm.sender_id)
        FROM public.chat_messages cm
        WHERE cm.room_id = cr.id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ) as last_message,
      -- Get unread count
      (
        SELECT count(*)::int
        FROM public.chat_messages cm
        WHERE cm.room_id = cr.id AND cm.created_at > cp.last_read_at AND cm.sender_id != v_user_id
      ) as unread_count
    FROM public.chat_participants cp
    JOIN public.chat_rooms cr ON cr.id = cp.room_id
    WHERE cp.user_id = v_user_id
    ORDER BY (
      SELECT COALESCE(MAX(cm.created_at), cr.created_at)
      FROM public.chat_messages cm
      WHERE cm.room_id = cr.id
    ) DESC
  ) r;

  RETURN v_result;
END;
$$;

-- RPC: mark_chat_read(p_room_id)
CREATE OR REPLACE FUNCTION public.mark_chat_read(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_participants
  SET last_read_at = now()
  WHERE room_id = p_room_id AND user_id = auth.uid();
END;
$$;
