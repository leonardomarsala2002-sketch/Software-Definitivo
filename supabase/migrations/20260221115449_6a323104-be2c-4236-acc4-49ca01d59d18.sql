
-- Add new columns to invitations
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS department public.department,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Add updated_at trigger
CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Replace handle_invitation_acceptance to also set accepted_at and create employee_details
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

      _has_primary := true;
    END IF;

    -- Create employee_details if role is employee and department is set
    IF _invitation.role = 'employee' AND _invitation.department IS NOT NULL AND _invitation.store_id IS NOT NULL THEN
      INSERT INTO public.employee_details (user_id, department)
      VALUES (NEW.id, _invitation.department)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- Mark invitation as accepted with timestamp
    UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = _invitation.id;
  END LOOP;

  RETURN NEW;
END;
$function$;
