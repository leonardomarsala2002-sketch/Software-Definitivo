
-- 1. Enums
CREATE TYPE public.department AS ENUM ('sala', 'cucina');
CREATE TYPE public.availability_type AS ENUM ('available', 'unavailable');
CREATE TYPE public.exception_type AS ENUM ('ferie', 'permesso', 'malattia', 'modifica_orario', 'altro');

-- 2.1 employee_details
CREATE TABLE public.employee_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  department public.department NOT NULL,
  weekly_contract_hours integer NOT NULL DEFAULT 40,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_employee_details_updated_at
  BEFORE UPDATE ON public.employee_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.2 employee_availability
CREATE TABLE public.employee_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  availability_type public.availability_type NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id, day_of_week, start_time)
);

-- 2.3 employee_exceptions
CREATE TABLE public.employee_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  exception_type public.exception_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for end_date >= start_date
CREATE OR REPLACE FUNCTION public.validate_exception_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date must be >= start_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_employee_exception_dates
  BEFORE INSERT OR UPDATE ON public.employee_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_exception_dates();

-- 3. Enable RLS
ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_exceptions ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies

-- employee_details SELECT
CREATE POLICY "Super admin reads all employee_details"
  ON public.employee_details FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin reads store employee_details"
  ON public.employee_details FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.user_store_assignments usa1
      JOIN public.user_store_assignments usa2 ON usa1.store_id = usa2.store_id
      WHERE usa1.user_id = auth.uid() AND usa2.user_id = employee_details.user_id
    )
  );

CREATE POLICY "Employee reads own employee_details"
  ON public.employee_details FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- employee_details INSERT
CREATE POLICY "Super admin inserts employee_details"
  ON public.employee_details FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin inserts store employee_details"
  ON public.employee_details FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.user_store_assignments usa1
      JOIN public.user_store_assignments usa2 ON usa1.store_id = usa2.store_id
      WHERE usa1.user_id = auth.uid() AND usa2.user_id = employee_details.user_id
    )
  );

-- employee_details UPDATE
CREATE POLICY "Super admin updates employee_details"
  ON public.employee_details FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin updates store employee_details"
  ON public.employee_details FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.user_store_assignments usa1
      JOIN public.user_store_assignments usa2 ON usa1.store_id = usa2.store_id
      WHERE usa1.user_id = auth.uid() AND usa2.user_id = employee_details.user_id
    )
  );

-- employee_details DELETE
CREATE POLICY "Super admin deletes employee_details"
  ON public.employee_details FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- employee_availability SELECT
CREATE POLICY "Super admin reads all availability"
  ON public.employee_availability FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin reads store availability"
  ON public.employee_availability FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own availability"
  ON public.employee_availability FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- employee_availability INSERT
CREATE POLICY "Super admin inserts availability"
  ON public.employee_availability FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin inserts store availability"
  ON public.employee_availability FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

-- employee_availability UPDATE
CREATE POLICY "Super admin updates availability"
  ON public.employee_availability FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin updates store availability"
  ON public.employee_availability FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

-- employee_availability DELETE
CREATE POLICY "Super admin deletes availability"
  ON public.employee_availability FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin deletes store availability"
  ON public.employee_availability FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

-- employee_exceptions SELECT
CREATE POLICY "Super admin reads all exceptions"
  ON public.employee_exceptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin reads store exceptions"
  ON public.employee_exceptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own exceptions"
  ON public.employee_exceptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- employee_exceptions INSERT (admin + employee own)
CREATE POLICY "Super admin inserts exceptions"
  ON public.employee_exceptions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin inserts store exceptions"
  ON public.employee_exceptions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee inserts own exceptions"
  ON public.employee_exceptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_store_member(auth.uid(), store_id));

-- employee_exceptions UPDATE
CREATE POLICY "Super admin updates exceptions"
  ON public.employee_exceptions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin updates store exceptions"
  ON public.employee_exceptions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

-- employee_exceptions DELETE
CREATE POLICY "Super admin deletes exceptions"
  ON public.employee_exceptions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin deletes store exceptions"
  ON public.employee_exceptions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));
