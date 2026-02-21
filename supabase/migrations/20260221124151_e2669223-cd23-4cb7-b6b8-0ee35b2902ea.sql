
-- Add split team hours columns for sala and cucina
ALTER TABLE public.store_rules
  ADD COLUMN IF NOT EXISTS max_daily_team_hours_sala integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS max_daily_team_hours_cucina integer NOT NULL DEFAULT 40;

-- Migrate existing max_daily_team_hours value to both new columns (split evenly)
UPDATE public.store_rules
  SET max_daily_team_hours_sala = CEIL(max_daily_team_hours::numeric / 2),
      max_daily_team_hours_cucina = FLOOR(max_daily_team_hours::numeric / 2)
  WHERE max_daily_team_hours IS NOT NULL;
