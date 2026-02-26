
-- Composite indexes for Phase 3 lending queries (shifts + coverage lookups by store/dept/date)
CREATE INDEX IF NOT EXISTS idx_shifts_store_dept_date_status 
  ON public.shifts (store_id, department, date, status) 
  WHERE is_day_off = false;

CREATE INDEX IF NOT EXISTS idx_coverage_store_dept_dow 
  ON public.store_coverage_requirements (store_id, department, day_of_week);

CREATE INDEX IF NOT EXISTS idx_lending_suggestions_run_user_date 
  ON public.lending_suggestions (generation_run_id, user_id, suggested_date);

CREATE INDEX IF NOT EXISTS idx_stores_city_active 
  ON public.stores (city, is_active) 
  WHERE is_active = true;
