-- ============================================================
-- daily_performance: tracking giornaliero per store
-- Campi manuali: incasso, coperti, budget
-- Calcoli automatici nell'UI: produttività oraria, % vs budget
-- Date: 2026-06-04
-- ============================================================

CREATE TABLE IF NOT EXISTS public.daily_performance (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date            date          NOT NULL,
  revenue_actual  numeric(10,2) NOT NULL DEFAULT 0,  -- Incasso reale del giorno (€)
  covers_count    integer       NOT NULL DEFAULT 0,   -- Coperti (clienti serviti)
  budget_daily    numeric(10,2) NOT NULL DEFAULT 0,   -- Obiettivo giornaliero (€)
  notes           text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  created_by      uuid          REFERENCES public.profiles(id),
  UNIQUE(store_id, date)
);

-- Indice per query per store e data (query tipica: settimana corrente per store)
CREATE INDEX IF NOT EXISTS idx_daily_performance_store_date
  ON public.daily_performance (store_id, date DESC);

-- updated_at automatico
CREATE OR REPLACE FUNCTION public.set_daily_performance_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_daily_performance_updated_at
  BEFORE UPDATE ON public.daily_performance
  FOR EACH ROW EXECUTE FUNCTION public.set_daily_performance_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.daily_performance ENABLE ROW LEVEL SECURITY;

-- Admin e store_manager: solo il proprio store
CREATE POLICY "Admin manages own store daily performance"
  ON public.daily_performance FOR ALL
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'store_manager'))
    AND is_store_member(auth.uid(), store_id)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'store_manager'))
    AND is_store_member(auth.uid(), store_id)
  );

-- Super admin: accesso a tutti gli store
CREATE POLICY "Super admin manages all daily performance"
  ON public.daily_performance FOR ALL
  USING  (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

COMMENT ON TABLE public.daily_performance IS
  'Dati giornalieri di performance per store: incasso, coperti, budget target. Calcoli derivati (produttività oraria, % budget) vengono fatti nel frontend.';
