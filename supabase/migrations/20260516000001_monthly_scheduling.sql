-- ============================================================
-- FASE 7: Scheduling mensile
-- Date: 2026-05-16
--
-- Cambia il ciclo da settimanale a mensile:
--   - schedule_periods traccia ogni mese con deadline richieste
--   - generation_runs e schedule_versions acquisiscono period_end
-- ============================================================

-- ─── 1. Aggiungi period_end a generation_runs ──────────────────────────────

ALTER TABLE public.generation_runs
  ADD COLUMN IF NOT EXISTS period_end date;

UPDATE public.generation_runs
  SET period_end = week_start + INTERVAL '6 days'
  WHERE period_end IS NULL AND week_start IS NOT NULL;

-- ─── 2. Aggiungi period_end a schedule_versions ───────────────────────────

ALTER TABLE public.schedule_versions
  ADD COLUMN IF NOT EXISTS period_end date;

UPDATE public.schedule_versions
  SET period_end = week_start + INTERVAL '6 days'
  WHERE period_end IS NULL AND week_start IS NOT NULL;

-- ─── 3. Tabella schedule_periods ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_periods (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start     date        NOT NULL,
  period_end       date        NOT NULL,
  request_deadline date        NOT NULL,
  status           text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed','generating','published','archived')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_schedule_periods_store_start
  ON public.schedule_periods (store_id, period_start DESC);

ALTER TABLE public.schedule_periods ENABLE ROW LEVEL SECURITY;

-- Manager e dipendenti possono leggere i periodi del proprio store
DROP POLICY IF EXISTS "schedule_periods_read" ON public.schedule_periods;
CREATE POLICY "schedule_periods_read"
  ON public.schedule_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_store_assignments usa
      WHERE usa.user_id = auth.uid()
        AND usa.store_id = schedule_periods.store_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- Solo manager possono scrivere
DROP POLICY IF EXISTS "schedule_periods_write" ON public.schedule_periods;
CREATE POLICY "schedule_periods_write"
  ON public.schedule_periods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_store_assignments usa
      JOIN public.user_roles ur ON ur.user_id = usa.user_id
      WHERE usa.user_id = auth.uid()
        AND usa.store_id = schedule_periods.store_id
        AND ur.role IN ('super_admin','admin','store_manager')
    )
  );

-- ─── 4. Funzione helper: upsert schedule_period per un mese ───────────────

CREATE OR REPLACE FUNCTION public.upsert_schedule_period(
  p_store_id       uuid,
  p_period_start   date,  -- primo giorno del mese
  p_period_end     date,  -- ultimo giorno del mese
  p_status         text DEFAULT 'generating'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deadline date;
  v_id       uuid;
BEGIN
  -- Deadline = 7 giorni prima del primo del mese
  v_deadline := p_period_start - INTERVAL '7 days';

  INSERT INTO public.schedule_periods (store_id, period_start, period_end, request_deadline, status)
  VALUES (p_store_id, p_period_start, p_period_end, v_deadline, p_status)
  ON CONFLICT (store_id, period_start)
  DO UPDATE SET
    period_end       = EXCLUDED.period_end,
    request_deadline = EXCLUDED.request_deadline,
    status           = EXCLUDED.status
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
