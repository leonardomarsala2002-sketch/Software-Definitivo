-- Fix existing store_rules: ensure minimum values for days off and splits
UPDATE public.store_rules
SET mandatory_days_off_per_week = 1
WHERE mandatory_days_off_per_week < 1;

UPDATE public.store_rules
SET max_split_shifts_per_employee_per_week = 1
WHERE max_split_shifts_per_employee_per_week < 1;

-- Add validation trigger to enforce minimums (CHECK constraints can't be added if existing data violates them in some edge cases, so use trigger)
CREATE OR REPLACE FUNCTION public.validate_store_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.mandatory_days_off_per_week < 1 THEN
    NEW.mandatory_days_off_per_week := 1;
  END IF;
  IF NEW.mandatory_days_off_per_week > 2 THEN
    NEW.mandatory_days_off_per_week := 2;
  END IF;
  IF NEW.max_split_shifts_per_employee_per_week < 1 THEN
    NEW.max_split_shifts_per_employee_per_week := 1;
  END IF;
  IF NEW.max_split_shifts_per_employee_per_week > 3 THEN
    NEW.max_split_shifts_per_employee_per_week := 3;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_store_rules_trigger
BEFORE INSERT OR UPDATE ON public.store_rules
FOR EACH ROW
EXECUTE FUNCTION public.validate_store_rules();