-- Add extra KPI columns to daily_performance
ALTER TABLE public.daily_performance
  ADD COLUMN IF NOT EXISTS dessert_pct  numeric(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS beverages_pct numeric(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sides_pct    numeric(5,2) DEFAULT NULL;

COMMENT ON COLUMN public.daily_performance.dessert_pct   IS '% dessert venduti sui coperti';
COMMENT ON COLUMN public.daily_performance.beverages_pct IS '% bevande vendute sui coperti';
COMMENT ON COLUMN public.daily_performance.sides_pct     IS '% dolci/contorni venduti sui coperti';
