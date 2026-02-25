
CREATE TABLE public.lending_request_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lending_request_id UUID NOT NULL REFERENCES public.lending_requests(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES public.profiles(id),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message TEXT NOT NULL
);

ALTER TABLE public.lending_request_messages ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin full access lending_request_messages"
  ON public.lending_request_messages FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin reads messages for requests involving their stores
CREATE POLICY "Admin reads lending_request_messages"
  ON public.lending_request_messages FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.lending_requests lr
      WHERE lr.id = lending_request_id
        AND (is_store_member(auth.uid(), lr.proposer_store_id) OR is_store_member(auth.uid(), lr.receiver_store_id))
    )
  );

-- Admin inserts messages on requests involving their stores
CREATE POLICY "Admin inserts lending_request_messages"
  ON public.lending_request_messages FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lending_requests lr
      WHERE lr.id = lending_request_id
        AND (is_store_member(auth.uid(), lr.proposer_store_id) OR is_store_member(auth.uid(), lr.receiver_store_id))
    )
  );

-- Employee reads messages on requests where they are target
CREATE POLICY "Employee reads own lending_request_messages"
  ON public.lending_request_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lending_requests lr
      WHERE lr.id = lending_request_id AND lr.target_user_id = auth.uid()
    )
  );

-- Index
CREATE INDEX idx_lending_request_messages_request ON public.lending_request_messages(lending_request_id);
CREATE INDEX idx_lending_request_messages_sender ON public.lending_request_messages(sender_user_id);
