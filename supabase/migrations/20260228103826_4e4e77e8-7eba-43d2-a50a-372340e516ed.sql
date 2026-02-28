
-- Add extended employee fields to invitations table
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS birth_place text,
  ADD COLUMN IF NOT EXISTS residence text,
  ADD COLUMN IF NOT EXISTS domicile text,
  ADD COLUMN IF NOT EXISTS fiscal_code text,
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS role_label text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS weekly_contract_hours integer;

-- Update the invitation acceptance trigger to copy extended fields to employee_details
CREATE OR REPLACE FUNCTION public.handle_invitation_acceptance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      INSERT INTO public.employee_details (user_id, department, phone, weekly_contract_hours, first_name, last_name, birth_date, birth_place, residence, domicile, fiscal_code, hire_date, level, contract_type, role_label)
      VALUES (
        NEW.id,
        _invitation.department,
        _invitation.phone,
        COALESCE(_invitation.weekly_contract_hours, 40),
        _invitation.first_name,
        _invitation.last_name,
        _invitation.birth_date,
        _invitation.birth_place,
        _invitation.residence,
        _invitation.domicile,
        _invitation.fiscal_code,
        _invitation.hire_date,
        _invitation.level,
        _invitation.contract_type,
        _invitation.role_label
      )
      ON CONFLICT (user_id) DO UPDATE SET
        phone = COALESCE(EXCLUDED.phone, employee_details.phone),
        weekly_contract_hours = COALESCE(EXCLUDED.weekly_contract_hours, employee_details.weekly_contract_hours),
        first_name = COALESCE(EXCLUDED.first_name, employee_details.first_name),
        last_name = COALESCE(EXCLUDED.last_name, employee_details.last_name),
        birth_date = COALESCE(EXCLUDED.birth_date, employee_details.birth_date),
        birth_place = COALESCE(EXCLUDED.birth_place, employee_details.birth_place),
        residence = COALESCE(EXCLUDED.residence, employee_details.residence),
        domicile = COALESCE(EXCLUDED.domicile, employee_details.domicile),
        fiscal_code = COALESCE(EXCLUDED.fiscal_code, employee_details.fiscal_code),
        hire_date = COALESCE(EXCLUDED.hire_date, employee_details.hire_date),
        level = COALESCE(EXCLUDED.level, employee_details.level),
        contract_type = COALESCE(EXCLUDED.contract_type, employee_details.contract_type),
        role_label = COALESCE(EXCLUDED.role_label, employee_details.role_label);
    END IF;
    UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = _invitation.id;
  END LOOP;
  RETURN NEW;
END;
$function$;
