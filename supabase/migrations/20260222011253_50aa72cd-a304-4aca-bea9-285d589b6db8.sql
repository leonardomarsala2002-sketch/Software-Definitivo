
-- Enum for shift status
CREATE TYPE public.shift_status AS ENUM ('draft', 'published');

-- Add status and generation_run_id to shifts
ALTER TABLE public.shifts ADD COLUMN status public.shift_status NOT NULL DEFAULT 'published';

-- Generation runs tracking table
CREATE TABLE public.generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  department public.department NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK from shifts to generation_runs
ALTER TABLE public.shifts ADD COLUMN generation_run_id uuid REFERENCES public.generation_runs(id);

-- Enable RLS
ALTER TABLE public.generation_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for generation_runs
CREATE POLICY "Super admin full access generation_runs"
  ON public.generation_runs FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manages own store generation_runs"
  ON public.generation_runs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own store generation_runs"
  ON public.generation_runs FOR SELECT
  USING (is_store_member(auth.uid(), store_id));

-- Trigger for updated_at
CREATE TRIGGER update_generation_runs_updated_at
  BEFORE UPDATE ON public.generation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
