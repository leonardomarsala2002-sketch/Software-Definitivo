-- =========================================================
-- STAGING DATABASE COMPLETE SETUP
-- Target: toswatskgyactslzdbfz
-- Run in SQL Editor of the staging project
-- =========================================================

-- ===================== PART 1: ENUMS =====================
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('super_admin','admin','employee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.department AS ENUM ('sala','cucina'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.availability_type AS ENUM ('available','unavailable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.exception_type AS ENUM ('ferie','permesso','malattia','modifica_orario','altro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.shift_time_kind AS ENUM ('entry','exit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================== PART 2: TABLES =====================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role app_role NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_store_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL,
  store_id uuid REFERENCES public.stores(id),
  department department,
  token text NOT NULL DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  department department NOT NULL,
  weekly_contract_hours integer NOT NULL DEFAULT 40,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  availability_type availability_type NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id, day_of_week, start_time)
);

CREATE TABLE IF NOT EXISTS public.employee_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  exception_type exception_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  custom_max_daily_hours integer,
  custom_max_weekly_hours integer,
  custom_max_split_shifts integer,
  custom_days_off integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_rules (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  max_daily_hours_per_employee integer NOT NULL DEFAULT 8,
  max_weekly_hours_per_employee integer NOT NULL DEFAULT 40,
  max_daily_team_hours integer NOT NULL DEFAULT 80,
  max_split_shifts_per_employee integer NOT NULL DEFAULT 1,
  mandatory_days_off_per_week integer NOT NULL DEFAULT 1,
  generation_enabled boolean NOT NULL DEFAULT false,
  max_split_shifts_per_employee_per_week integer NOT NULL DEFAULT 3,
  max_daily_team_hours_cucina integer NOT NULL DEFAULT 40,
  max_daily_team_hours_sala integer NOT NULL DEFAULT 40,
  max_team_hours_cucina_per_week integer NOT NULL DEFAULT 240,
  max_team_hours_sala_per_week integer NOT NULL DEFAULT 240,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  opening_time time NOT NULL,
  closing_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_coverage_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  hour_slot time NOT NULL,
  department department NOT NULL,
  min_staff_required integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_shift_allowed_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  department department NOT NULL,
  hour smallint NOT NULL,
  kind shift_time_kind NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  department department NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  department department NOT NULL,
  is_day_off boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid NOT NULL,
  request_date date NOT NULL,
  request_type text NOT NULL,
  department text NOT NULL,
  selected_hour smallint,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================== PART 3: FUNCTIONS =====================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_store_member(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_store_assignments WHERE user_id = _user_id AND store_id = _store_id);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.validate_exception_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN RAISE EXCEPTION 'end_date must be >= start_date'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_invitation_acceptance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _invitation RECORD;
  _has_primary BOOLEAN;
BEGIN
  FOR _invitation IN
    SELECT * FROM public.invitations
    WHERE lower(email) = lower(NEW.email) AND status = 'pending' AND expires_at > now()
  LOOP
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _invitation.role) ON CONFLICT (user_id) DO NOTHING;
    SELECT EXISTS (SELECT 1 FROM public.user_store_assignments WHERE user_id = NEW.id AND is_primary = true) INTO _has_primary;
    IF _invitation.store_id IS NOT NULL THEN
      INSERT INTO public.user_store_assignments (user_id, store_id, is_primary)
      VALUES (NEW.id, _invitation.store_id, NOT _has_primary) ON CONFLICT (user_id, store_id) DO NOTHING;
      _has_primary := true;
    END IF;
    IF _invitation.role = 'employee' AND _invitation.department IS NOT NULL AND _invitation.store_id IS NOT NULL THEN
      INSERT INTO public.employee_details (user_id, department) VALUES (NEW.id, _invitation.department) ON CONFLICT (user_id) DO NOTHING;
    END IF;
    UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = _invitation.id;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ===================== PART 4: TRIGGERS =====================

-- Auth triggers (handle_new_user on auth.users) must be set up via Supabase Dashboard
-- Here we set up triggers on public tables only

DROP TRIGGER IF EXISTS update_employee_details_updated_at ON public.employee_details;
CREATE TRIGGER update_employee_details_updated_at BEFORE UPDATE ON public.employee_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON public.stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_store_rules_updated_at ON public.store_rules;
CREATE TRIGGER update_store_rules_updated_at BEFORE UPDATE ON public.store_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_invitations_updated_at ON public.invitations;
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS validate_exception_dates_trigger ON public.employee_exceptions;
CREATE TRIGGER validate_exception_dates_trigger BEFORE INSERT OR UPDATE ON public.employee_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_exception_dates();

DROP TRIGGER IF EXISTS update_employee_constraints_updated_at ON public.employee_constraints;
CREATE TRIGGER update_employee_constraints_updated_at BEFORE UPDATE ON public.employee_constraints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_store_opening_hours_updated_at ON public.store_opening_hours;
CREATE TRIGGER update_store_opening_hours_updated_at BEFORE UPDATE ON public.store_opening_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_store_coverage_updated_at ON public.store_coverage_requirements;
CREATE TRIGGER update_store_coverage_updated_at BEFORE UPDATE ON public.store_coverage_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_store_shift_allowed_times_updated_at ON public.store_shift_allowed_times;
CREATE TRIGGER update_store_shift_allowed_times_updated_at BEFORE UPDATE ON public.store_shift_allowed_times
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_time_off_requests_updated_at ON public.time_off_requests;
CREATE TRIGGER update_time_off_requests_updated_at BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== PART 5: RLS =====================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_coverage_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_shift_allowed_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- profiles policies
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Super admin reads all profiles" ON public.profiles;
CREATE POLICY "Super admin reads all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin reads store colleagues" ON public.profiles;
CREATE POLICY "Admin reads store colleagues" ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_store_assignments usa1 JOIN user_store_assignments usa2 ON usa1.store_id = usa2.store_id WHERE usa1.user_id = auth.uid() AND usa2.user_id = profiles.id));

-- stores policies
DROP POLICY IF EXISTS "Super admin full access stores" ON public.stores;
CREATE POLICY "Super admin full access stores" ON public.stores FOR ALL USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Members read own stores" ON public.stores;
CREATE POLICY "Members read own stores" ON public.stores FOR SELECT USING (is_store_member(auth.uid(), id));

-- user_roles policies
DROP POLICY IF EXISTS "Users read own role" ON public.user_roles;
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admin reads all roles" ON public.user_roles;
CREATE POLICY "Super admin reads all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

-- user_store_assignments policies
DROP POLICY IF EXISTS "Users read own assignments" ON public.user_store_assignments;
CREATE POLICY "Users read own assignments" ON public.user_store_assignments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin reads store assignments" ON public.user_store_assignments;
CREATE POLICY "Admin reads store assignments" ON public.user_store_assignments FOR SELECT USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Super admin full access assignments" ON public.user_store_assignments;
CREATE POLICY "Super admin full access assignments" ON public.user_store_assignments FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- invitations policies
DROP POLICY IF EXISTS "Super admin full access invitations" ON public.invitations;
CREATE POLICY "Super admin full access invitations" ON public.invitations FOR ALL USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin manages own store invitations" ON public.invitations;
CREATE POLICY "Admin manages own store invitations" ON public.invitations FOR ALL USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Users read own invitations" ON public.invitations;
CREATE POLICY "Users read own invitations" ON public.invitations FOR SELECT USING (lower(email) = lower(auth.email()));

-- employee_details policies
DROP POLICY IF EXISTS "Super admin reads all employee_details" ON public.employee_details;
CREATE POLICY "Super admin reads all employee_details" ON public.employee_details FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin inserts employee_details" ON public.employee_details;
CREATE POLICY "Super admin inserts employee_details" ON public.employee_details FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin updates employee_details" ON public.employee_details;
CREATE POLICY "Super admin updates employee_details" ON public.employee_details FOR UPDATE USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin deletes employee_details" ON public.employee_details;
CREATE POLICY "Super admin deletes employee_details" ON public.employee_details FOR DELETE USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Employee reads own employee_details" ON public.employee_details;
CREATE POLICY "Employee reads own employee_details" ON public.employee_details FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin reads store employee_details" ON public.employee_details;
CREATE POLICY "Admin reads store employee_details" ON public.employee_details FOR SELECT
  USING (has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM user_store_assignments usa1 JOIN user_store_assignments usa2 ON usa1.store_id = usa2.store_id WHERE usa1.user_id = auth.uid() AND usa2.user_id = employee_details.user_id));

DROP POLICY IF EXISTS "Admin inserts store employee_details" ON public.employee_details;
CREATE POLICY "Admin inserts store employee_details" ON public.employee_details FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM user_store_assignments usa1 JOIN user_store_assignments usa2 ON usa1.store_id = usa2.store_id WHERE usa1.user_id = auth.uid() AND usa2.user_id = employee_details.user_id));

DROP POLICY IF EXISTS "Admin updates store employee_details" ON public.employee_details;
CREATE POLICY "Admin updates store employee_details" ON public.employee_details FOR UPDATE
  USING (has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM user_store_assignments usa1 JOIN user_store_assignments usa2 ON usa1.store_id = usa2.store_id WHERE usa1.user_id = auth.uid() AND usa2.user_id = employee_details.user_id));

-- employee_availability policies
DROP POLICY IF EXISTS "Super admin reads all availability" ON public.employee_availability;
CREATE POLICY "Super admin reads all availability" ON public.employee_availability FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin inserts availability" ON public.employee_availability;
CREATE POLICY "Super admin inserts availability" ON public.employee_availability FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin updates availability" ON public.employee_availability;
CREATE POLICY "Super admin updates availability" ON public.employee_availability FOR UPDATE USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin deletes availability" ON public.employee_availability;
CREATE POLICY "Super admin deletes availability" ON public.employee_availability FOR DELETE USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Employee reads own availability" ON public.employee_availability;
CREATE POLICY "Employee reads own availability" ON public.employee_availability FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin reads store availability" ON public.employee_availability;
CREATE POLICY "Admin reads store availability" ON public.employee_availability FOR SELECT USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Admin inserts store availability" ON public.employee_availability;
CREATE POLICY "Admin inserts store availability" ON public.employee_availability FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Admin updates store availability" ON public.employee_availability;
CREATE POLICY "Admin updates store availability" ON public.employee_availability FOR UPDATE USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Admin deletes store availability" ON public.employee_availability;
CREATE POLICY "Admin deletes store availability" ON public.employee_availability FOR DELETE USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

-- employee_exceptions policies
DROP POLICY IF EXISTS "Super admin reads all exceptions" ON public.employee_exceptions;
CREATE POLICY "Super admin reads all exceptions" ON public.employee_exceptions FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin inserts exceptions" ON public.employee_exceptions;
CREATE POLICY "Super admin inserts exceptions" ON public.employee_exceptions FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin updates exceptions" ON public.employee_exceptions;
CREATE POLICY "Super admin updates exceptions" ON public.employee_exceptions FOR UPDATE USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin deletes exceptions" ON public.employee_exceptions;
CREATE POLICY "Super admin deletes exceptions" ON public.employee_exceptions FOR DELETE USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Employee reads own exceptions" ON public.employee_exceptions;
CREATE POLICY "Employee reads own exceptions" ON public.employee_exceptions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Employee inserts own exceptions" ON public.employee_exceptions;
CREATE POLICY "Employee inserts own exceptions" ON public.employee_exceptions FOR INSERT WITH CHECK (user_id = auth.uid() AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Admin reads store exceptions" ON public.employee_exceptions;
CREATE POLICY "Admin reads store exceptions" ON public.employee_exceptions FOR SELECT USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Admin inserts store exceptions" ON public.employee_exceptions;
CREATE POLICY "Admin inserts store exceptions" ON public.employee_exceptions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Admin updates store exceptions" ON public.employee_exceptions;
CREATE POLICY "Admin updates store exceptions" ON public.employee_exceptions FOR UPDATE USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Admin deletes store exceptions" ON public.employee_exceptions;
CREATE POLICY "Admin deletes store exceptions" ON public.employee_exceptions FOR DELETE USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

-- employee_constraints policies
DROP POLICY IF EXISTS "Super admin full access employee_constraints" ON public.employee_constraints;
CREATE POLICY "Super admin full access employee_constraints" ON public.employee_constraints FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin manages store employee_constraints" ON public.employee_constraints;
CREATE POLICY "Admin manages store employee_constraints" ON public.employee_constraints FOR ALL USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id)) WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Employee reads own constraints" ON public.employee_constraints;
CREATE POLICY "Employee reads own constraints" ON public.employee_constraints FOR SELECT USING (user_id = auth.uid());

-- store_rules policies
DROP POLICY IF EXISTS "Super admin full access store_rules" ON public.store_rules;
CREATE POLICY "Super admin full access store_rules" ON public.store_rules FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin manages own store_rules" ON public.store_rules;
CREATE POLICY "Admin manages own store_rules" ON public.store_rules FOR ALL USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id)) WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Employee reads own store_rules" ON public.store_rules;
CREATE POLICY "Employee reads own store_rules" ON public.store_rules FOR SELECT USING (is_store_member(auth.uid(), store_id));

-- store_opening_hours policies
DROP POLICY IF EXISTS "Super admin full access store_opening_hours" ON public.store_opening_hours;
CREATE POLICY "Super admin full access store_opening_hours" ON public.store_opening_hours FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin manages own store_opening_hours" ON public.store_opening_hours;
CREATE POLICY "Admin manages own store_opening_hours" ON public.store_opening_hours FOR ALL USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id)) WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Employee reads own store_opening_hours" ON public.store_opening_hours;
CREATE POLICY "Employee reads own store_opening_hours" ON public.store_opening_hours FOR SELECT USING (is_store_member(auth.uid(), store_id));

-- store_coverage_requirements policies
DROP POLICY IF EXISTS "Super admin full access store_coverage" ON public.store_coverage_requirements;
CREATE POLICY "Super admin full access store_coverage" ON public.store_coverage_requirements FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin manages own store_coverage" ON public.store_coverage_requirements;
CREATE POLICY "Admin manages own store_coverage" ON public.store_coverage_requirements FOR ALL USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id)) WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Employee reads own store_coverage" ON public.store_coverage_requirements;
CREATE POLICY "Employee reads own store_coverage" ON public.store_coverage_requirements FOR SELECT USING (is_store_member(auth.uid(), store_id));

-- store_shift_allowed_times policies
DROP POLICY IF EXISTS "Super admin full access shift_allowed_times" ON public.store_shift_allowed_times;
CREATE POLICY "Super admin full access shift_allowed_times" ON public.store_shift_allowed_times FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin manages own store shift_allowed_times" ON public.store_shift_allowed_times;
CREATE POLICY "Admin manages own store shift_allowed_times" ON public.store_shift_allowed_times FOR ALL USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id)) WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Employee reads own store shift_allowed_times" ON public.store_shift_allowed_times;
CREATE POLICY "Employee reads own store shift_allowed_times" ON public.store_shift_allowed_times FOR SELECT USING (is_store_member(auth.uid(), store_id));

-- store_shift_templates policies
DROP POLICY IF EXISTS "Super admin full access shift_templates" ON public.store_shift_templates;
CREATE POLICY "Super admin full access shift_templates" ON public.store_shift_templates FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin manages own store shift_templates" ON public.store_shift_templates;
CREATE POLICY "Admin manages own store shift_templates" ON public.store_shift_templates FOR ALL USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id)) WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Employee reads own store shift_templates" ON public.store_shift_templates;
CREATE POLICY "Employee reads own store shift_templates" ON public.store_shift_templates FOR SELECT USING (is_store_member(auth.uid(), store_id));

-- shifts policies
DROP POLICY IF EXISTS "Super admin full access shifts" ON public.shifts;
CREATE POLICY "Super admin full access shifts" ON public.shifts FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin manages own store shifts" ON public.shifts;
CREATE POLICY "Admin manages own store shifts" ON public.shifts FOR ALL USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id)) WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Employee reads own store shifts" ON public.shifts;
CREATE POLICY "Employee reads own store shifts" ON public.shifts FOR SELECT USING (is_store_member(auth.uid(), store_id));

-- time_off_requests policies
DROP POLICY IF EXISTS "Super admin full access requests" ON public.time_off_requests;
CREATE POLICY "Super admin full access requests" ON public.time_off_requests FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin manages store requests" ON public.time_off_requests;
CREATE POLICY "Admin manages store requests" ON public.time_off_requests FOR ALL USING (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id)) WITH CHECK (has_role(auth.uid(), 'admin') AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Employee reads own requests" ON public.time_off_requests;
CREATE POLICY "Employee reads own requests" ON public.time_off_requests FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Employee inserts own requests" ON public.time_off_requests;
CREATE POLICY "Employee inserts own requests" ON public.time_off_requests FOR INSERT WITH CHECK (user_id = auth.uid() AND is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Employee deletes own pending requests" ON public.time_off_requests;
CREATE POLICY "Employee deletes own pending requests" ON public.time_off_requests FOR DELETE USING (user_id = auth.uid() AND status = 'pending');

-- ===================== PART 6: AUTH TRIGGER =====================
-- This trigger auto-creates profiles on user signup
-- Must be created here since it references auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===================== PART 7: SEED DATA =====================

DO $$
DECLARE
  -- Store IDs (3 store)
  s1 uuid := 'a0000001-0000-0000-0000-000000000001';
  s2 uuid := 'a0000001-0000-0000-0000-000000000002';
  s3 uuid := 'a0000001-0000-0000-0000-000000000003';
  v_store_ids uuid[] := ARRAY[
    'a0000001-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000003'
  ];

  -- Super admin
  sa uuid := 'b0000001-0000-0000-0000-000000000000';

  -- Admin IDs (one per store)
  v_admin_ids uuid[] := ARRAY[
    'b0000001-0000-0000-0000-000000000001',
    'b0000001-0000-0000-0000-000000000002',
    'b0000001-0000-0000-0000-000000000003'
  ];

  v_first_names text[] := ARRAY[
    'Marco','Giulia','Luca','Sara','Andrea','Valentina','Davide','Elisa',
    'Matteo','Chiara','Alessandro','Federica','Simone','Martina','Lorenzo',
    'Alessia','Nicola','Giorgia','Tommaso','Elena'
  ];
  v_last_names text[] := ARRAY[
    'Rossi','Bianchi','Colombo','Ricci','Marino','Greco','Fontana','Conti',
    'De Luca','Costa','Giordano','Mancini','Barbieri','Lombardi','Moretti',
    'Galli','Ferrara','Santoro','Marchetti','Leone'
  ];

  v_emp_idx int := 0;
  v_emp_uuid uuid;
  v_first text;
  v_last text;
  v_dept department;
  v_hours int;
  v_day int;
  v_si int;
  v_store uuid;
  v_phone text;
  v_start_h int;
  v_end_h int;
  v_today date := CURRENT_DATE;
  v_monday date;
  v_shift_date date;
  v_email text;

  -- Employees per store: 7, 7, 6 = 20 total
  v_emps_counts int[] := ARRAY[7, 7, 6];

BEGIN
  -- Calculate current week Monday
  v_monday := v_today - ((extract(isodow from v_today)::int - 1) || ' days')::interval;

  -- 1. Insert stores (2 in Milano for lending test, 1 in Roma)
  INSERT INTO stores (id, name, address, city) VALUES
    (s1, 'Store Milano Duomo', 'Piazza del Duomo 1, 20121 Milano', 'Milano'),
    (s2, 'Store Milano Navigli', 'Ripa di Porta Ticinese 7, 20143 Milano', 'Milano'),
    (s3, 'Store Roma Trastevere', 'Via della Lungaretta 15, 00153 Roma', 'Roma')
  ON CONFLICT DO NOTHING;

  -- 2. Super admin
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data) 
  VALUES (sa, 'authenticated', 'authenticated', 'mario.bianchi@demo.com', now(), jsonb_build_object('full_name', 'Mario Bianchi')) 
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO profiles (id, full_name, email) VALUES (sa, 'Mario Bianchi', 'mario.bianchi@demo.com') ON CONFLICT DO NOTHING;
  INSERT INTO user_roles (user_id, role) VALUES (sa, 'super_admin') ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO user_store_assignments (user_id, store_id, is_primary) VALUES (sa, s1, true) ON CONFLICT (user_id, store_id) DO NOTHING;

  -- 3. Admins (one per store)
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data) VALUES
    (v_admin_ids[1], 'authenticated', 'authenticated', 'laura.verdi@demo.com', now(), jsonb_build_object('full_name', 'Laura Verdi')),
    (v_admin_ids[2], 'authenticated', 'authenticated', 'giuseppe.russo@demo.com', now(), jsonb_build_object('full_name', 'Giuseppe Russo')),
    (v_admin_ids[3], 'authenticated', 'authenticated', 'francesca.esposito@demo.com', now(), jsonb_build_object('full_name', 'Francesca Esposito'))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, full_name, email) VALUES
    (v_admin_ids[1], 'Laura Verdi', 'laura.verdi@demo.com'),
    (v_admin_ids[2], 'Giuseppe Russo', 'giuseppe.russo@demo.com'),
    (v_admin_ids[3], 'Francesca Esposito', 'francesca.esposito@demo.com')
  ON CONFLICT DO NOTHING;

  FOR v_si IN 1..3 LOOP
    INSERT INTO user_roles (user_id, role) VALUES (v_admin_ids[v_si], 'admin') ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO user_store_assignments (user_id, store_id, is_primary) VALUES (v_admin_ids[v_si], v_store_ids[v_si], true) ON CONFLICT (user_id, store_id) DO NOTHING;
  END LOOP;

  -- 4. Employees (20 total: 7 + 7 + 6)
  FOR v_si IN 1..3 LOOP
    v_store := v_store_ids[v_si];

    FOR i IN 1..v_emps_counts[v_si] LOOP
      v_emp_idx := v_emp_idx + 1;
      v_emp_uuid := ('c0000001-0000-0000-0000-' || lpad(v_emp_idx::text, 12, '0'))::uuid;
      v_first := v_first_names[1 + ((v_emp_idx - 1) % array_length(v_first_names, 1))];
      v_last := v_last_names[1 + ((v_emp_idx - 1) % array_length(v_last_names, 1))];
      v_email := lower(replace(v_first,' ','')) || '.' || lower(replace(v_last,' ','')) || v_emp_idx || '@demo.com';
      v_dept := CASE WHEN (v_emp_idx % 3) = 0 THEN 'cucina'::department ELSE 'sala'::department END;
      v_hours := (ARRAY[20, 24, 30, 36, 40])[1 + (v_emp_idx % 5)];
      v_phone := '+39 ' || (330 + (v_emp_idx % 20))::text || ' ' || lpad((1000000 + v_emp_idx * 137)::text, 7, '0');

      INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data) 
      VALUES (v_emp_uuid, 'authenticated', 'authenticated', v_email, now(), jsonb_build_object('full_name', v_first || ' ' || v_last))
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO profiles (id, full_name, email) VALUES
        (v_emp_uuid, v_first || ' ' || v_last, v_email)
      ON CONFLICT DO NOTHING;

      INSERT INTO user_roles (user_id, role) VALUES (v_emp_uuid, 'employee') ON CONFLICT (user_id) DO NOTHING;
      INSERT INTO user_store_assignments (user_id, store_id, is_primary) VALUES (v_emp_uuid, v_store, true) ON CONFLICT (user_id, store_id) DO NOTHING;
      INSERT INTO employee_details (user_id, department, weekly_contract_hours, phone) VALUES
        (v_emp_uuid, v_dept, v_hours, v_phone)
      ON CONFLICT (user_id) DO NOTHING;

      -- Availability: 5 days available, 1 day off
      v_start_h := CASE WHEN v_dept = 'sala' THEN 10 ELSE 8 END;
      v_end_h := CASE WHEN v_dept = 'sala' THEN 23 ELSE 22 END;

      FOR v_day IN 0..5 LOOP
        IF v_day <> (v_emp_idx % 6) THEN
          INSERT INTO employee_availability (user_id, store_id, day_of_week, start_time, end_time, availability_type) VALUES
            (v_emp_uuid, v_store, v_day, (lpad(v_start_h::text, 2, '0') || ':00')::time, (lpad(v_end_h::text, 2, '0') || ':00')::time, 'available')
          ON CONFLICT (user_id, store_id, day_of_week, start_time) DO NOTHING;
        END IF;
      END LOOP;

      -- Exceptions for some employees
      IF (v_emp_idx % 4) = 1 THEN
        INSERT INTO employee_exceptions (user_id, store_id, exception_type, start_date, end_date, notes, created_by) VALUES
          (v_emp_uuid, v_store,
           CASE WHEN (v_emp_idx % 5) = 0 THEN 'malattia'::exception_type
                WHEN (v_emp_idx % 5) = 1 THEN 'ferie'::exception_type
                ELSE 'permesso'::exception_type END,
           v_today + ((v_emp_idx % 14) || ' days')::interval,
           v_today + ((v_emp_idx % 14 + 2) || ' days')::interval,
           CASE WHEN (v_emp_idx % 5) = 0 THEN 'Certificato medico inviato'
                WHEN (v_emp_idx % 5) = 1 THEN 'Ferie programmate'
                ELSE 'Permesso personale' END,
           v_admin_ids[v_si]);
      END IF;

      -- Shifts for current week
      FOR v_day IN 0..5 LOOP
        v_shift_date := v_monday + v_day;
        IF v_day = (v_emp_idx % 6) THEN
          INSERT INTO shifts (store_id, user_id, date, department, is_day_off) VALUES
            (v_store, v_emp_uuid, v_shift_date, v_dept, true);
        ELSE
          IF (v_emp_idx + v_day) % 2 = 0 THEN
            INSERT INTO shifts (store_id, user_id, date, start_time, end_time, department, is_day_off) VALUES
              (v_store, v_emp_uuid, v_shift_date, '10:00', '15:00', v_dept, false);
          ELSE
            INSERT INTO shifts (store_id, user_id, date, start_time, end_time, department, is_day_off) VALUES
              (v_store, v_emp_uuid, v_shift_date, '17:00', '23:00', v_dept, false);
          END IF;
        END IF;
      END LOOP;

    END LOOP;
  END LOOP;

  -- 5. Store rules
  FOR v_si IN 1..3 LOOP
    INSERT INTO store_rules (store_id, max_daily_hours_per_employee, max_weekly_hours_per_employee,
      max_daily_team_hours, max_split_shifts_per_employee, mandatory_days_off_per_week,
      generation_enabled, max_split_shifts_per_employee_per_week,
      max_daily_team_hours_cucina, max_daily_team_hours_sala,
      max_team_hours_cucina_per_week, max_team_hours_sala_per_week) VALUES
    (v_store_ids[v_si], 10, 48, 120, 1, 1, true, 3, 50, 70, 300, 420)
    ON CONFLICT (store_id) DO NOTHING;
  END LOOP;

  -- 6. Store opening hours
  FOR v_si IN 1..3 LOOP
    FOR v_day IN 0..6 LOOP
      INSERT INTO store_opening_hours (store_id, day_of_week, opening_time, closing_time) VALUES
        (v_store_ids[v_si], v_day,
         CASE WHEN v_day = 6 THEN '11:00'::time ELSE '10:00'::time END,
         '23:59'::time);
    END LOOP;
  END LOOP;

  -- 7. Store coverage requirements
  FOR v_si IN 1..3 LOOP
    FOR v_day IN 0..5 LOOP
      FOR v_start_h IN 12..14 LOOP
        INSERT INTO store_coverage_requirements (store_id, day_of_week, hour_slot, department, min_staff_required) VALUES
          (v_store_ids[v_si], v_day, (lpad(v_start_h::text, 2, '0') || ':00')::time, 'sala', 2 + (v_si % 2));
      END LOOP;
      FOR v_start_h IN 19..22 LOOP
        INSERT INTO store_coverage_requirements (store_id, day_of_week, hour_slot, department, min_staff_required) VALUES
          (v_store_ids[v_si], v_day, (lpad(v_start_h::text, 2, '0') || ':00')::time, 'sala', 3 + (v_si % 2));
      END LOOP;
      FOR v_start_h IN 11..14 LOOP
        INSERT INTO store_coverage_requirements (store_id, day_of_week, hour_slot, department, min_staff_required) VALUES
          (v_store_ids[v_si], v_day, (lpad(v_start_h::text, 2, '0') || ':00')::time, 'cucina', 1 + (v_si % 2));
      END LOOP;
      FOR v_start_h IN 18..22 LOOP
        INSERT INTO store_coverage_requirements (store_id, day_of_week, hour_slot, department, min_staff_required) VALUES
          (v_store_ids[v_si], v_day, (lpad(v_start_h::text, 2, '0') || ':00')::time, 'cucina', 2 + (v_si % 2));
      END LOOP;
    END LOOP;
  END LOOP;

  -- 8. Allowed entry/exit times
  FOR v_si IN 1..3 LOOP
    FOREACH v_start_h IN ARRAY ARRAY[8,9,10,11,12,17,18,19] LOOP
      INSERT INTO store_shift_allowed_times (store_id, department, hour, kind, is_active) VALUES
        (v_store_ids[v_si], 'sala', v_start_h, 'entry', true),
        (v_store_ids[v_si], 'cucina', v_start_h, 'entry', true);
    END LOOP;
    FOREACH v_end_h IN ARRAY ARRAY[14,15,16,22,23] LOOP
      INSERT INTO store_shift_allowed_times (store_id, department, hour, kind, is_active) VALUES
        (v_store_ids[v_si], 'sala', v_end_h, 'exit', true),
        (v_store_ids[v_si], 'cucina', v_end_h, 'exit', true);
    END LOOP;
  END LOOP;

  -- 9. Time off requests
  FOR v_si IN 1..3 LOOP
    v_store := v_store_ids[v_si];
    FOR i IN 1..3 LOOP
      v_emp_idx := ((v_si - 1) * 7) + i;
      v_emp_uuid := ('c0000001-0000-0000-0000-' || lpad(v_emp_idx::text, 12, '0'))::uuid;
      INSERT INTO time_off_requests (user_id, store_id, request_date, request_type, department, status, notes) VALUES
        (v_emp_uuid, v_store, v_today + (i * 7), 
         CASE WHEN i = 1 THEN 'ferie' WHEN i = 2 THEN 'permesso' ELSE 'malattia' END,
         CASE WHEN (v_emp_idx % 3) = 0 THEN 'cucina' ELSE 'sala' END,
         CASE WHEN i = 1 THEN 'pending' WHEN i = 2 THEN 'approved' ELSE 'rejected' END,
         CASE WHEN i = 1 THEN 'Vorrei prendere ferie' WHEN i = 2 THEN 'Visita medica' ELSE 'Impegno personale' END);
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed completato: 3 store, 20 dipendenti, turni settimana corrente';
END $$;