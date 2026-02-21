
-- Create shifts table for storing employee shifts
CREATE TABLE public.shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  department public.department NOT NULL,
  is_day_off boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_shifts_store_date ON public.shifts (store_id, date);
CREATE INDEX idx_shifts_user_date ON public.shifts (user_id, date);

-- Enable RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admin full access shifts"
ON public.shifts FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin manages own store shifts"
ON public.shifts FOR ALL
USING (public.has_role(auth.uid(), 'admin') AND public.is_store_member(auth.uid(), store_id))
WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own store shifts"
ON public.shifts FOR SELECT
USING (public.is_store_member(auth.uid(), store_id));

-- Trigger for updated_at
CREATE TRIGGER update_shifts_updated_at
BEFORE UPDATE ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
