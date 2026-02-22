
-- 1. Add city to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS city text;

-- 2. Add vacation_balance to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vacation_balance integer NOT NULL DEFAULT 0;

-- 3. Create employee_monthly_stats
CREATE TABLE public.employee_monthly_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  month smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  year smallint NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  total_hours numeric NOT NULL DEFAULT 0,
  split_shifts_count integer NOT NULL DEFAULT 0,
  weekend_shifts_count integer NOT NULL DEFAULT 0,
  days_off_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id, month, year)
);

ALTER TABLE public.employee_monthly_stats ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_employee_monthly_stats_updated_at
  BEFORE UPDATE ON public.employee_monthly_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for employee_monthly_stats
CREATE POLICY "Super admin full access employee_monthly_stats"
  ON public.employee_monthly_stats FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manages store employee_monthly_stats"
  ON public.employee_monthly_stats FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own monthly_stats"
  ON public.employee_monthly_stats FOR SELECT
  USING (user_id = auth.uid());

-- 4. Create global_settings
CREATE TABLE public.global_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_global_settings_updated_at
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: only super_admin can manage, admin can read
CREATE POLICY "Super admin full access global_settings"
  ON public.global_settings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin reads global_settings"
  ON public.global_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default global settings
INSERT INTO public.global_settings (key, value, description) VALUES
  ('fixed_days_off', '{"enabled": false, "count": 2}', 'Se abilitato, tutti i dipendenti hanno N giorni liberi fissi a settimana'),
  ('lending_same_city_only', '{"enabled": true}', 'I prestiti tra store avvengono solo nella stessa città');
