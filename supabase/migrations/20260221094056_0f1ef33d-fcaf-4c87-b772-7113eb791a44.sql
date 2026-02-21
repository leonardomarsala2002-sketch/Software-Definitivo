
-- 1. Enum app_role
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'employee');

-- 2. Tabella stores
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabella profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabella user_roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL
);

-- 5. Tabella user_store_assignments
CREATE TABLE public.user_store_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- 6. Tabella invitations
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 8. Helper: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- 9. Helper: get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

-- 10. Helper: is_store_member
CREATE OR REPLACE FUNCTION public.is_store_member(_user_id UUID, _store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_store_assignments WHERE user_id = _user_id AND store_id = _store_id
  );
$$;

-- 11. Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Trigger: accept invitation after signup (case-insensitive + smart is_primary)
CREATE OR REPLACE FUNCTION public.handle_invitation_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation RECORD;
  _has_primary BOOLEAN;
BEGIN
  FOR _invitation IN
    SELECT * FROM public.invitations
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pending'
      AND expires_at > now()
  LOOP
    -- Assign role (only if not already assigned)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _invitation.role)
    ON CONFLICT (user_id) DO NOTHING;

    -- Check if user already has a primary store
    SELECT EXISTS (
      SELECT 1 FROM public.user_store_assignments
      WHERE user_id = NEW.id AND is_primary = true
    ) INTO _has_primary;

    -- Assign store (if specified)
    IF _invitation.store_id IS NOT NULL THEN
      INSERT INTO public.user_store_assignments (user_id, store_id, is_primary)
      VALUES (NEW.id, _invitation.store_id, NOT _has_primary)
      ON CONFLICT (user_id, store_id) DO NOTHING;

      -- After first insert, any subsequent store won't be primary
      _has_primary := true;
    END IF;

    -- Mark invitation as accepted
    UPDATE public.invitations SET status = 'accepted' WHERE id = _invitation.id;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_accept_invitation
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_invitation_acceptance();

-- 13. Trigger: updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. RLS: profiles
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Super admin reads all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin reads store colleagues" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_store_assignments usa1
    JOIN public.user_store_assignments usa2 ON usa1.store_id = usa2.store_id
    WHERE usa1.user_id = auth.uid() AND usa2.user_id = profiles.id
  )
);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 15. RLS: user_roles
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admin reads all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- 16. RLS: user_store_assignments
CREATE POLICY "Users read own assignments" ON public.user_store_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admin full access assignments" ON public.user_store_assignments FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin reads store assignments" ON public.user_store_assignments FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') AND public.is_store_member(auth.uid(), store_id)
);

-- 17. RLS: stores
CREATE POLICY "Super admin full access stores" ON public.stores FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Members read own stores" ON public.stores FOR SELECT USING (public.is_store_member(auth.uid(), id));

-- 18. RLS: invitations
CREATE POLICY "Super admin full access invitations" ON public.invitations FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin manages own store invitations" ON public.invitations FOR ALL USING (
  public.has_role(auth.uid(), 'admin') AND public.is_store_member(auth.uid(), store_id)
);
CREATE POLICY "Users read own invitations" ON public.invitations FOR SELECT USING (lower(email) = lower(auth.email()));
