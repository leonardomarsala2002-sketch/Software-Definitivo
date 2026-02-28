
-- Fix broken RLS policies on conversations table
-- The bug: cp.conversation_id = cp.id (compares wrong columns)
-- Should be: cp.conversation_id = conversations.id

DROP POLICY IF EXISTS "Users read own conversations" ON public.conversations;
CREATE POLICY "Users read own conversations"
ON public.conversations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Participants update conversations" ON public.conversations;
CREATE POLICY "Participants update conversations"
ON public.conversations FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
));
