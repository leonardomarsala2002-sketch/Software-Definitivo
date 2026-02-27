-- Add accepted_gaps column to generation_runs for persisting admin-accepted uncovered slots
ALTER TABLE public.generation_runs
ADD COLUMN accepted_gaps jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.generation_runs.accepted_gaps IS 'Array of gap IDs (suggestion IDs) that the admin has accepted as-is, e.g. ["uncov-sala-2025-03-10"]';