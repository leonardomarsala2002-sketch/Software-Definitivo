
-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'meeting',
  notes TEXT,
  appointment_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  target_user_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin full access appointments"
  ON public.appointments FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin manages store appointments
CREATE POLICY "Admin manages store appointments"
  ON public.appointments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

-- Employee reads own appointments
CREATE POLICY "Employee reads own appointments"
  ON public.appointments FOR SELECT
  USING (target_user_id = auth.uid());

-- Employee updates own appointments (accept/decline)
CREATE POLICY "Employee updates own appointments"
  ON public.appointments FOR UPDATE
  USING (target_user_id = auth.uid())
  WITH CHECK (target_user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
