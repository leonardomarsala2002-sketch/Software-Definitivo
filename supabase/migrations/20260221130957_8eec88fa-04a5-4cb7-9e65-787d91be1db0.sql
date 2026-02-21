
-- Add weekly columns to store_rules (keeping old daily columns for backward compat)
ALTER TABLE public.store_rules
  ADD COLUMN IF NOT EXISTS max_team_hours_sala_per_week integer NOT NULL DEFAULT 240,
  ADD COLUMN IF NOT EXISTS max_team_hours_cucina_per_week integer NOT NULL DEFAULT 240,
  ADD COLUMN IF NOT EXISTS max_split_shifts_per_employee_per_week integer NOT NULL DEFAULT 3;

-- Migrate: estimate weekly from daily (daily * 7)
UPDATE public.store_rules
SET
  max_team_hours_sala_per_week = COALESCE(max_daily_team_hours_sala, 40) * 7,
  max_team_hours_cucina_per_week = COALESCE(max_daily_team_hours_cucina, 40) * 7,
  max_split_shifts_per_employee_per_week = COALESCE(max_split_shifts_per_employee, 1) * 3;

-- Create store_shift_templates table
CREATE TABLE public.store_shift_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  department public.department NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access shift_templates"
  ON public.store_shift_templates FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manages own store shift_templates"
  ON public.store_shift_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own store shift_templates"
  ON public.store_shift_templates FOR SELECT
  USING (is_store_member(auth.uid(), store_id));

CREATE TRIGGER update_shift_templates_updated_at
  BEFORE UPDATE ON public.store_shift_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
