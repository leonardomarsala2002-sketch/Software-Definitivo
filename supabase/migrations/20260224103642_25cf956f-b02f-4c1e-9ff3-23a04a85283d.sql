
-- Create generation_adjustments table
CREATE TABLE public.generation_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  adjustment_type text NOT NULL,
  extra_hours numeric(4,1) NOT NULL DEFAULT 0,
  notes text,
  source_suggestion_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generation_adjustments ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin full access generation_adjustments"
  ON public.generation_adjustments FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin manages own store
CREATE POLICY "Admin manages store generation_adjustments"
  ON public.generation_adjustments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

-- Employee reads own
CREATE POLICY "Employee reads own generation_adjustments"
  ON public.generation_adjustments FOR SELECT
  USING (user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_generation_adjustments_store_week
  ON public.generation_adjustments (store_id, week_start);
