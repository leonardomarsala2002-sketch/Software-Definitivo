-- Estende employee_preferences con campi questionario orari
-- Usato dal component SchedulePreferencesQuiz (UI dipendenti)
-- e dal generatore generate-optimized-schedule per soft constraints.

ALTER TABLE public.employee_preferences
  ADD COLUMN IF NOT EXISTS prefer_split_shifts      boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_consecutive_days     integer  NOT NULL DEFAULT 5
                             CHECK (max_consecutive_days BETWEEN 2 AND 7),
  ADD COLUMN IF NOT EXISTS preference_notes         text,
  ADD COLUMN IF NOT EXISTS preferred_weekly_hours   integer
                             CHECK (preferred_weekly_hours BETWEEN 1 AND 60),
  ADD COLUMN IF NOT EXISTS quiz_completed           boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiz_completed_at        timestamptz;

-- Indice per trovare rapidamente i dipendenti che non hanno ancora compilato il quiz
CREATE INDEX IF NOT EXISTS idx_emp_prefs_quiz_completed
  ON public.employee_preferences (store_id, quiz_completed);

COMMENT ON COLUMN public.employee_preferences.prefer_split_shifts IS
  'True se il dipendente preferisce turni spezzati (pranzo + cena)';
COMMENT ON COLUMN public.employee_preferences.max_consecutive_days IS
  'Massimo giorni consecutivi che il dipendente vuole lavorare (2-7, default 5)';
COMMENT ON COLUMN public.employee_preferences.preference_notes IS
  'Note libere del dipendente (es. indisponibile il mercoledì mattina)';
COMMENT ON COLUMN public.employee_preferences.preferred_weekly_hours IS
  'Ore settimanali preferite dal dipendente (può differire dal contratto)';
COMMENT ON COLUMN public.employee_preferences.quiz_completed IS
  'True quando il dipendente ha completato il questionario preferenze';
