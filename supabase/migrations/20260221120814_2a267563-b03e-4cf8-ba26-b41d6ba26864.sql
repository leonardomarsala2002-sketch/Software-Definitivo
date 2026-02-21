
-- 1. store_rules (1:1 con stores)
CREATE TABLE public.store_rules (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  max_daily_hours_per_employee integer NOT NULL DEFAULT 8,
  max_weekly_hours_per_employee integer NOT NULL DEFAULT 40,
  max_daily_team_hours integer NOT NULL DEFAULT 80,
  max_split_shifts_per_employee integer NOT NULL DEFAULT 1,
  mandatory_days_off_per_week integer NOT NULL DEFAULT 1,
  generation_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_rules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_store_rules_updated_at
  BEFORE UPDATE ON public.store_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS store_rules
CREATE POLICY "Super admin full access store_rules"
  ON public.store_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin manages own store_rules"
  ON public.store_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own store_rules"
  ON public.store_rules FOR SELECT TO authenticated
  USING (is_store_member(auth.uid(), store_id));

-- 2. store_opening_hours
CREATE TABLE public.store_opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  opening_time time NOT NULL,
  closing_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, day_of_week),
  CHECK (day_of_week BETWEEN 0 AND 6),
  CHECK (closing_time > opening_time)
);

ALTER TABLE public.store_opening_hours ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_store_opening_hours_updated_at
  BEFORE UPDATE ON public.store_opening_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS store_opening_hours
CREATE POLICY "Super admin full access store_opening_hours"
  ON public.store_opening_hours FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin manages own store_opening_hours"
  ON public.store_opening_hours FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own store_opening_hours"
  ON public.store_opening_hours FOR SELECT TO authenticated
  USING (is_store_member(auth.uid(), store_id));

-- 3. store_coverage_requirements
CREATE TABLE public.store_coverage_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  hour_slot time NOT NULL,
  department public.department NOT NULL,
  min_staff_required integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, day_of_week, hour_slot, department),
  CHECK (day_of_week BETWEEN 0 AND 6),
  CHECK (min_staff_required >= 0)
);

ALTER TABLE public.store_coverage_requirements ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_store_coverage_updated_at
  BEFORE UPDATE ON public.store_coverage_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS store_coverage_requirements
CREATE POLICY "Super admin full access store_coverage"
  ON public.store_coverage_requirements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin manages own store_coverage"
  ON public.store_coverage_requirements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own store_coverage"
  ON public.store_coverage_requirements FOR SELECT TO authenticated
  USING (is_store_member(auth.uid(), store_id));

-- 4. employee_constraints (override per dipendente)
CREATE TABLE public.employee_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  custom_max_daily_hours integer,
  custom_max_weekly_hours integer,
  custom_max_split_shifts integer,
  custom_days_off integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);

ALTER TABLE public.employee_constraints ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_employee_constraints_updated_at
  BEFORE UPDATE ON public.employee_constraints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS employee_constraints
CREATE POLICY "Super admin full access employee_constraints"
  ON public.employee_constraints FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin manages store employee_constraints"
  ON public.employee_constraints FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own constraints"
  ON public.employee_constraints FOR SELECT TO authenticated
  USING (user_id = auth.uid());
