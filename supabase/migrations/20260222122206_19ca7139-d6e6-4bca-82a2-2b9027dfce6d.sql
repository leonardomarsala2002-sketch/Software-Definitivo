
-- Add suggestions jsonb column to generation_runs for server-side optimization suggestions
ALTER TABLE public.generation_runs ADD COLUMN IF NOT EXISTS suggestions jsonb DEFAULT NULL;
