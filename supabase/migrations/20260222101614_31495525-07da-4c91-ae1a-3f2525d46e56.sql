
-- Employee stats table for hour bank tracking
CREATE TABLE public.employee_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  current_balance NUMERIC(6,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

ALTER TABLE public.employee_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access employee_stats"
  ON public.employee_stats FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manages store employee_stats"
  ON public.employee_stats FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own stats"
  ON public.employee_stats FOR SELECT
  USING (user_id = auth.uid());

CREATE TRIGGER update_employee_stats_updated_at
  BEFORE UPDATE ON public.employee_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cross-store lending suggestions
CREATE TABLE public.lending_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_run_id UUID NOT NULL REFERENCES public.generation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  source_store_id UUID NOT NULL REFERENCES public.stores(id),
  target_store_id UUID NOT NULL REFERENCES public.stores(id),
  suggested_date DATE NOT NULL,
  suggested_start_time TIME NOT NULL,
  suggested_end_time TIME NOT NULL,
  department TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lending_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access lending_suggestions"
  ON public.lending_suggestions FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin reads own store lending_suggestions"
  ON public.lending_suggestions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) AND (is_store_member(auth.uid(), source_store_id) OR is_store_member(auth.uid(), target_store_id)));

-- Add fitness_score and iterations_run to generation_runs
ALTER TABLE public.generation_runs
  ADD COLUMN fitness_score NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN iterations_run INTEGER DEFAULT NULL,
  ADD COLUMN hour_adjustments JSONB DEFAULT NULL;
