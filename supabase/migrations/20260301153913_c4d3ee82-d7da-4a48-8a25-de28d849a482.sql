
-- Engine rules: editable prompt constraints for the generation algorithm
CREATE TABLE public.engine_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.engine_rules ENABLE ROW LEVEL SECURITY;

-- Only super_admin and admin can manage engine rules
CREATE POLICY "Admin reads engine_rules" ON public.engine_rules
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin manages engine_rules" ON public.engine_rules
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manages engine_rules" ON public.engine_rules
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_engine_rules_updated_at
  BEFORE UPDATE ON public.engine_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with current hardcoded rules
INSERT INTO public.engine_rules (label, description, sort_order) VALUES
  ('Tolleranza ore contrattuali', 'Il motore accetta deviazioni entro ±5h dal contratto settimanale senza penalità. Oltre viene applicata una penalità di -30/h per forzare il rientro.', 1),
  ('Compensazione automatica', 'Se l''admin accetta una deviazione ±5h, la differenza viene compensata automaticamente nella settimana successiva.', 2),
  ('Riposo minimo 11h', 'Tra la fine di un turno e l''inizio del successivo devono passare almeno 11 ore (vincolo inviolabile).', 3),
  ('Durata minima turno', 'Ogni turno deve durare almeno 3 ore.', 4),
  ('40 tentativi di generazione', 'Il motore esegue fino a 40 iterazioni per trovare la soluzione ottimale.', 5),
  ('Fallback se fallisce', 'Se la generazione fallisce: 1) aumenta gli spezzati di +1 a testa, 2) propone deviazioni ±5h con motivazione.', 6),
  ('Cutoff richieste', 'Le richieste inviate dopo il giovedì valgono dalla settimana successiva.', 7),
  ('Generazione automatica', 'Ogni giovedì alle 03:00 UTC viene generata la bozza dei turni per la settimana ISO successiva.', 8),
  ('Prestiti inter-store', 'L''unico tipo di suggerimento mostrato in UI riguarda i prestiti tra store (mancanza personale o surplus ≥3h).', 9),
  ('Merge turni contigui', 'Turni adiacenti dello stesso dipendente nello stesso giorno vengono automaticamente uniti in un unico turno.', 10),
  ('Rispetto orari consentiti', 'Il motore usa esclusivamente gli orari di entrata/uscita configurati nello store. Non crea orari dinamici.', 11),
  ('Copertura min-max', 'Il motore riempie prima fino al minimo richiesto, poi continua fino al massimo se i dipendenti hanno ore contrattuali da completare.', 12);
