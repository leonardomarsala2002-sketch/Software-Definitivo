
-- Conversations table
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Conversation participants
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Index for fast message lookups
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);

-- Helper: check if user can message another user based on role rules
CREATE OR REPLACE FUNCTION public.can_message(_sender_id uuid, _receiver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_role app_role;
  _receiver_role app_role;
  _share_store boolean;
BEGIN
  SELECT role INTO _sender_role FROM user_roles WHERE user_id = _sender_id LIMIT 1;
  SELECT role INTO _receiver_role FROM user_roles WHERE user_id = _receiver_id LIMIT 1;

  IF _sender_role IS NULL OR _receiver_role IS NULL THEN
    RETURN false;
  END IF;

  -- Super admin can message other super_admins and all admins
  IF _sender_role = 'super_admin' THEN
    RETURN _receiver_role IN ('super_admin', 'admin');
  END IF;

  -- Admin can message: own employees (same store), other admins (any store), super_admins
  IF _sender_role = 'admin' THEN
    IF _receiver_role IN ('admin', 'super_admin') THEN
      RETURN true;
    END IF;
    IF _receiver_role = 'employee' THEN
      -- Must share a store
      SELECT EXISTS (
        SELECT 1 FROM user_store_assignments usa1
        JOIN user_store_assignments usa2 ON usa1.store_id = usa2.store_id
        WHERE usa1.user_id = _sender_id AND usa2.user_id = _receiver_id
      ) INTO _share_store;
      RETURN _share_store;
    END IF;
    RETURN false;
  END IF;

  -- Employee can only message admins of their own store
  IF _sender_role = 'employee' THEN
    IF _receiver_role = 'admin' THEN
      SELECT EXISTS (
        SELECT 1 FROM user_store_assignments usa1
        JOIN user_store_assignments usa2 ON usa1.store_id = usa2.store_id
        WHERE usa1.user_id = _sender_id AND usa2.user_id = _receiver_id
      ) INTO _share_store;
      RETURN _share_store;
    END IF;
    RETURN false;
  END IF;

  RETURN false;
END;
$$;

-- RLS: conversations - user is participant
CREATE POLICY "Users read own conversations"
ON public.conversations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
));

CREATE POLICY "Authenticated users create conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Participants update conversations"
ON public.conversations FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
));

-- RLS: conversation_participants
CREATE POLICY "Users read own participations"
ON public.conversation_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp2
    WHERE cp2.conversation_id = conversation_participants.conversation_id
    AND cp2.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users insert participants"
ON public.conversation_participants FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS: messages
CREATE POLICY "Participants read messages"
ON public.messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
));

CREATE POLICY "Participants insert messages"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Participants update messages"
ON public.messages FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
));

-- Trigger to update conversation.updated_at on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_on_message();
