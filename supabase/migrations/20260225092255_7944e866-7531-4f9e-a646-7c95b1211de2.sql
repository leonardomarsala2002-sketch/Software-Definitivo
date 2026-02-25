
-- Create lending_requests table
CREATE TABLE public.lending_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'modified', 'cancelled', 'completed')),
  proposer_store_id UUID NOT NULL REFERENCES public.stores(id),
  receiver_store_id UUID NOT NULL REFERENCES public.stores(id),
  proposer_user_id UUID NOT NULL REFERENCES public.profiles(id),
  target_user_id UUID NOT NULL REFERENCES public.profiles(id),
  date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  reason TEXT,
  last_modified_by UUID REFERENCES public.profiles(id),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lending_requests ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin full access lending_requests"
  ON public.lending_requests FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin reads requests involving their stores
CREATE POLICY "Admin reads own store lending_requests"
  ON public.lending_requests FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND (is_store_member(auth.uid(), proposer_store_id) OR is_store_member(auth.uid(), receiver_store_id))
  );

-- Admin inserts requests from their stores
CREATE POLICY "Admin inserts lending_requests"
  ON public.lending_requests FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND is_store_member(auth.uid(), proposer_store_id)
  );

-- Admin updates requests involving their stores
CREATE POLICY "Admin updates lending_requests"
  ON public.lending_requests FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND (is_store_member(auth.uid(), proposer_store_id) OR is_store_member(auth.uid(), receiver_store_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND (is_store_member(auth.uid(), proposer_store_id) OR is_store_member(auth.uid(), receiver_store_id))
  );

-- Employee reads requests where they are the target
CREATE POLICY "Employee reads own lending_requests"
  ON public.lending_requests FOR SELECT
  USING (target_user_id = auth.uid());

-- Indexes
CREATE INDEX idx_lending_requests_proposer_store ON public.lending_requests(proposer_store_id);
CREATE INDEX idx_lending_requests_receiver_store ON public.lending_requests(receiver_store_id);
CREATE INDEX idx_lending_requests_target_user ON public.lending_requests(target_user_id);
CREATE INDEX idx_lending_requests_date ON public.lending_requests(date);
CREATE INDEX idx_lending_requests_status ON public.lending_requests(status);
