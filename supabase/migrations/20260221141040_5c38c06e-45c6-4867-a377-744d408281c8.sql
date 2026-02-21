
-- Time off requests table
CREATE TABLE public.time_off_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  store_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('full_day_off', 'morning_off', 'evening_off', 'ferie', 'permesso', 'malattia')),
  request_date date NOT NULL,
  selected_hour smallint, -- the hour chosen from allowed times (exit for morning, entry for evening)
  department text NOT NULL CHECK (department IN ('sala', 'cucina')),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_time_off_requests_user ON public.time_off_requests(user_id, request_date);
CREATE INDEX idx_time_off_requests_store ON public.time_off_requests(store_id, status);

-- Updated_at trigger
CREATE TRIGGER update_time_off_requests_updated_at
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- Employee can create own requests
CREATE POLICY "Employee inserts own requests"
  ON public.time_off_requests FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_store_member(auth.uid(), store_id));

-- Employee can read own requests
CREATE POLICY "Employee reads own requests"
  ON public.time_off_requests FOR SELECT
  USING (user_id = auth.uid());

-- Employee can delete own pending requests
CREATE POLICY "Employee deletes own pending requests"
  ON public.time_off_requests FOR DELETE
  USING (user_id = auth.uid() AND status = 'pending');

-- Admin manages store requests
CREATE POLICY "Admin manages store requests"
  ON public.time_off_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

-- Super admin full access
CREATE POLICY "Super admin full access requests"
  ON public.time_off_requests FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
