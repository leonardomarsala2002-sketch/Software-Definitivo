
-- Create enum for entry/exit
CREATE TYPE public.shift_time_kind AS ENUM ('entry', 'exit');

-- Create allowed times table
CREATE TABLE public.store_shift_allowed_times (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  department public.department NOT NULL,
  kind public.shift_time_kind NOT NULL,
  hour smallint NOT NULL CHECK (hour >= 0 AND hour <= 24),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, department, kind, hour)
);

-- Enable RLS
ALTER TABLE public.store_shift_allowed_times ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admin full access shift_allowed_times"
  ON public.store_shift_allowed_times FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manages own store shift_allowed_times"
  ON public.store_shift_allowed_times FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own store shift_allowed_times"
  ON public.store_shift_allowed_times FOR SELECT
  USING (is_store_member(auth.uid(), store_id));

-- Trigger for updated_at
CREATE TRIGGER update_store_shift_allowed_times_updated_at
  BEFORE UPDATE ON public.store_shift_allowed_times
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
