-- Add dual approval columns to lending_suggestions
ALTER TABLE public.lending_suggestions 
  ADD COLUMN IF NOT EXISTS source_approved boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_approved boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_approved_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_approved_by uuid DEFAULT NULL;

-- Update status logic: pending -> source_approved/target_approved -> accepted (both approved) / declined
COMMENT ON COLUMN public.lending_suggestions.source_approved IS 'Approval from source store admin';
COMMENT ON COLUMN public.lending_suggestions.target_approved IS 'Approval from target store admin';