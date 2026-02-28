
-- Table to track historical suggestion outcomes for smart memory
CREATE TABLE public.suggestion_outcomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  department text NOT NULL,
  day_of_week smallint NOT NULL, -- 0=Mon..6=Sun
  hour_slot smallint NOT NULL, -- 0-23
  outcome text NOT NULL, -- 'accepted', 'rejected', 'gap_accepted', 'lending_accepted', 'lending_rejected'
  action_type text, -- 'shift_earlier', 'shift_later', 'add_split', 'lending', 'remove_surplus', etc.
  week_start date NOT NULL,
  suggestion_id text, -- original suggestion ID for traceability
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX idx_suggestion_outcomes_store_dept ON public.suggestion_outcomes(store_id, department);
CREATE INDEX idx_suggestion_outcomes_user ON public.suggestion_outcomes(user_id, day_of_week, hour_slot);
CREATE INDEX idx_suggestion_outcomes_lookup ON public.suggestion_outcomes(store_id, department, day_of_week, hour_slot, user_id);

-- RLS
ALTER TABLE public.suggestion_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access suggestion_outcomes"
  ON public.suggestion_outcomes FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manages store suggestion_outcomes"
  ON public.suggestion_outcomes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Service insert suggestion_outcomes"
  ON public.suggestion_outcomes FOR INSERT
  WITH CHECK (true);
