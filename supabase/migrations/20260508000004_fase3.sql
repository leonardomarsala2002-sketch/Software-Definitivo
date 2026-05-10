-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 3 — Gestione richieste dipendenti, malattia, contatori, onboarding,
--           notifiche multi-canale
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. ILLNESS_CERTIFICATES ────────────────────────────────────────────────
-- Deve venire prima di time_off_requests perché viene referenziata da FK.

CREATE TABLE IF NOT EXISTS public.illness_certificates (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id          uuid        NOT NULL REFERENCES public.stores(id)   ON DELETE CASCADE,
  start_date        date        NOT NULL,
  end_date          date        NOT NULL,
  certificate_url   text        NOT NULL,
  storage_path      text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
  validated_by      uuid        REFERENCES public.profiles(id),
  validated_at      timestamptz,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT illness_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_illness_certificates_user
  ON public.illness_certificates (user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_illness_certificates_store
  ON public.illness_certificates (store_id, status);

ALTER TABLE public.illness_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "illness_certificates_employee_own"
  ON public.illness_certificates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "illness_certificates_employee_insert"
  ON public.illness_certificates FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "illness_certificates_manager_select"
  ON public.illness_certificates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin', 'store_manager')
    )
  );

CREATE POLICY "illness_certificates_manager_update"
  ON public.illness_certificates FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin', 'store_manager')
    )
  );

-- ─── 2. AGGIORNA TIME_OFF_REQUESTS ──────────────────────────────────────────

-- Mappa vecchi nomi → nuovi (idempotente: i vecchi tipi semplicemente non
-- esisteranno più dopo il DROP CONSTRAINT e la re-aggiunta).
ALTER TABLE public.time_off_requests
  DROP CONSTRAINT IF EXISTS time_off_requests_request_type_check;

UPDATE public.time_off_requests
  SET request_type = 'giorno_libero'  WHERE request_type = 'full_day_off';
UPDATE public.time_off_requests
  SET request_type = 'mattina_libera' WHERE request_type = 'morning_off';
UPDATE public.time_off_requests
  SET request_type = 'sera_libera'    WHERE request_type = 'evening_off';

ALTER TABLE public.time_off_requests
  ADD CONSTRAINT time_off_requests_request_type_check
    CHECK (request_type IN (
      'giorno_libero', 'mattina_libera', 'sera_libera',
      'ferie', 'permesso', 'permesso_104', 'malattia'
    ));

-- Department non è rilevante per il tipo di assenza: lo rendiamo nullable.
ALTER TABLE public.time_off_requests
  DROP CONSTRAINT IF EXISTS time_off_requests_department_check;

ALTER TABLE public.time_off_requests
  ALTER COLUMN department DROP NOT NULL;

-- CHECK rimane valido per valori non-null (NULL supera per default il CHECK).
ALTER TABLE public.time_off_requests
  ADD CONSTRAINT time_off_requests_department_check
    CHECK (department IS NULL OR department IN ('sala', 'cucina'));

-- FK verso illness_certificates (nullable: solo le richieste malattia da certificato)
ALTER TABLE public.time_off_requests
  ADD COLUMN IF NOT EXISTS illness_certificate_id uuid
    REFERENCES public.illness_certificates(id) ON DELETE SET NULL;

-- ─── 3. EMPLOYEE_LEAVE_BALANCES ─────────────────────────────────────────────
-- Fonte di verità per i saldi. total_hours è settabile manualmente da admin;
-- used_hours è aggiornato atomicamente dalle funzioni approve/reject.

CREATE TABLE IF NOT EXISTS public.employee_leave_balances (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id    uuid           NOT NULL REFERENCES public.stores(id)   ON DELETE CASCADE,
  year        integer        NOT NULL,
  leave_type  text           NOT NULL
                             CHECK (leave_type IN ('ferie', 'permesso', 'permesso_104')),
  total_hours numeric(6, 2)  NOT NULL DEFAULT 0,
  used_hours  numeric(6, 2)  NOT NULL DEFAULT 0,
  created_at  timestamptz    NOT NULL DEFAULT now(),
  updated_at  timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id, year, leave_type),
  CONSTRAINT leave_hours_check CHECK (used_hours >= 0 AND total_hours >= 0)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user
  ON public.employee_leave_balances (user_id, store_id, year);

ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_balances_employee_own"
  ON public.employee_leave_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "leave_balances_manager_select"
  ON public.employee_leave_balances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin', 'store_manager')
    )
  );

CREATE POLICY "leave_balances_admin_all"
  ON public.employee_leave_balances FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_leave_balances_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_leave_balances_updated_at ON public.employee_leave_balances;
CREATE TRIGGER trg_leave_balances_updated_at
  BEFORE UPDATE ON public.employee_leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_leave_balances_updated_at();

-- ─── 4. EMPLOYEE_PREFERENCES (onboarding) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_preferences (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id                    uuid        NOT NULL REFERENCES public.stores(id)   ON DELETE CASCADE,
  preferred_shift_type        text        CHECK (preferred_shift_type IN ('morning', 'afternoon', 'evening', 'any')),
  preferred_days_off          integer[]   NOT NULL DEFAULT '{}',
  weekend_availability        text        NOT NULL DEFAULT 'available'
                                          CHECK (weekend_availability IN ('available', 'unavailable', 'limited')),
  prefers_opening             boolean     NOT NULL DEFAULT false,
  prefers_closing             boolean     NOT NULL DEFAULT false,
  recurring_limits            text,
  hour_distribution           text        CHECK (hour_distribution IN ('front_loaded', 'even', 'back_loaded')),
  onboarding_completed        boolean     NOT NULL DEFAULT false,
  onboarding_completed_at     timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preferences_employee_own"
  ON public.employee_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "preferences_manager_select"
  ON public.employee_preferences FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin', 'store_manager')
    )
  );

CREATE OR REPLACE FUNCTION public.update_employee_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_preferences_updated_at ON public.employee_preferences;
CREATE TRIGGER trg_preferences_updated_at
  BEFORE UPDATE ON public.employee_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_employee_preferences_updated_at();

-- ─── 5. AGGIORNA NOTIFICATIONS ──────────────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS channel  text        NOT NULL DEFAULT 'in-app'
                                                CHECK (channel IN ('in-app', 'email', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS read_at  timestamptz;

-- Trigger: setta read_at quando is_read viene portato a true
CREATE OR REPLACE FUNCTION public.set_notification_read_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_read = true AND (OLD.is_read = false OR OLD.is_read IS NULL) THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notification_read_at ON public.notifications;
CREATE TRIGGER trg_notification_read_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_notification_read_at();

-- ─── 6. AGGIORNA STORE_RULES ────────────────────────────────────────────────

ALTER TABLE public.store_rules
  ADD COLUMN IF NOT EXISTS block_over_balance           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leave_request_deadline_days  integer NOT NULL DEFAULT 4;
-- Default 4 = giovedì della settimana precedente (lunedì settimana target - 4 gg)

-- ─── 7. STORAGE BUCKET (illness-certificates) ───────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'illness-certificates',
  'illness-certificates',
  false,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "illness_cert_employee_upload" ON storage.objects;
CREATE POLICY "illness_cert_employee_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'illness-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "illness_cert_own_read" ON storage.objects;
CREATE POLICY "illness_cert_own_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'illness-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "illness_cert_manager_read" ON storage.objects;
CREATE POLICY "illness_cert_manager_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'illness-certificates'
    AND EXISTS (
      SELECT 1 FROM public.illness_certificates ic
      JOIN public.user_store_assignments usa ON usa.store_id = ic.store_id
      WHERE ic.storage_path = name
        AND usa.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin', 'store_manager')
    )
  );

-- ─── 8. FUNZIONI ATOMICHE ───────────────────────────────────────────────────

-- Approva una richiesta e aggiorna il saldo
CREATE OR REPLACE FUNCTION public.approve_time_off_request(
  p_request_id  uuid,
  p_reviewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req         public.time_off_requests;
  v_daily_h     numeric(6, 2) := 8.0;
  v_total_def   numeric(6, 2);
  v_year        integer;
BEGIN
  SELECT * INTO v_req FROM public.time_off_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found');
  END IF;
  IF v_req.status = 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already approved');
  END IF;

  UPDATE public.time_off_requests
  SET status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  -- Aggiorna saldo solo per tipi tracciati
  IF v_req.request_type IN ('ferie', 'permesso', 'permesso_104') THEN
    v_year := EXTRACT(YEAR FROM v_req.request_date)::integer;

    SELECT COALESCE(ed.weekly_contract_hours, 40)::numeric / 5.0
    INTO v_daily_h
    FROM public.employee_details ed
    WHERE ed.user_id = v_req.user_id LIMIT 1;

    -- Ferie: weekly_contract_hours × 4 = ore totali (4 settimane, legge italiana).
    -- 40h/week × 4 = 160h = 20 giorni × 8h/g. Corretto per contratti standard.
    v_total_def := CASE v_req.request_type
      WHEN 'ferie'        THEN COALESCE(
        (SELECT ed2.weekly_contract_hours FROM public.employee_details ed2
         WHERE ed2.user_id = v_req.user_id LIMIT 1)::numeric, 40) * 4.0
      WHEN 'permesso'     THEN 24.0
      WHEN 'permesso_104' THEN 0.0
    END;

    INSERT INTO public.employee_leave_balances
      (user_id, store_id, year, leave_type, total_hours, used_hours)
    VALUES
      (v_req.user_id, v_req.store_id, v_year, v_req.request_type, v_total_def, v_daily_h)
    ON CONFLICT (user_id, store_id, year, leave_type) DO UPDATE
      SET used_hours = employee_leave_balances.used_hours + v_daily_h,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $$;

-- Rifiuta una richiesta (e ripristina saldo se era già approvata)
CREATE OR REPLACE FUNCTION public.reject_time_off_request(
  p_request_id  uuid,
  p_reviewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req       public.time_off_requests;
  v_daily_h   numeric(6, 2) := 8.0;
  v_year      integer;
BEGIN
  SELECT * INTO v_req FROM public.time_off_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found');
  END IF;
  IF v_req.status = 'rejected' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already rejected');
  END IF;

  UPDATE public.time_off_requests
  SET status = 'rejected', reviewed_by = p_reviewer_id, reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  -- Ripristina ore se era già approvata
  IF v_req.status = 'approved' AND v_req.request_type IN ('ferie', 'permesso', 'permesso_104') THEN
    v_year := EXTRACT(YEAR FROM v_req.request_date)::integer;

    SELECT COALESCE(ed.weekly_contract_hours, 40)::numeric / 5.0
    INTO v_daily_h
    FROM public.employee_details ed
    WHERE ed.user_id = v_req.user_id LIMIT 1;

    UPDATE public.employee_leave_balances
    SET used_hours = GREATEST(0, used_hours - v_daily_h),
        updated_at = now()
    WHERE user_id = v_req.user_id
      AND store_id = v_req.store_id
      AND year     = v_year
      AND leave_type = v_req.request_type;
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $$;

-- Valida/rifiuta un certificato malattia e gestisce le richieste collegate
CREATE OR REPLACE FUNCTION public.validate_illness_certificate(
  p_certificate_id uuid,
  p_validator_id   uuid,
  p_status         text  -- 'approved' | 'rejected'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert    public.illness_certificates;
  v_cur     date;
  v_days    integer := 0;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_cert FROM public.illness_certificates WHERE id = p_certificate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Certificate not found');
  END IF;
  IF v_cert.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Certificate already processed');
  END IF;

  UPDATE public.illness_certificates
  SET status = p_status, validated_by = p_validator_id, validated_at = now()
  WHERE id = p_certificate_id;

  IF p_status = 'approved' THEN
    -- Crea/aggiorna time_off_requests malattia per ogni giorno del range
    v_cur := v_cert.start_date;
    WHILE v_cur <= v_cert.end_date LOOP
      IF EXISTS (
        SELECT 1 FROM public.time_off_requests
        WHERE user_id = v_cert.user_id AND request_date = v_cur AND request_type = 'malattia'
      ) THEN
        UPDATE public.time_off_requests
        SET status = 'approved',
            reviewed_by = p_validator_id,
            reviewed_at = now(),
            updated_at = now(),
            illness_certificate_id = p_certificate_id
        WHERE user_id = v_cert.user_id AND request_date = v_cur AND request_type = 'malattia';
      ELSE
        INSERT INTO public.time_off_requests
          (user_id, store_id, request_type, request_date, status,
           reviewed_by, reviewed_at, illness_certificate_id, notes)
        VALUES
          (v_cert.user_id, v_cert.store_id, 'malattia', v_cur, 'approved',
           p_validator_id, now(), p_certificate_id, 'Auto-approvata da certificato medico');
      END IF;
      v_days := v_days + 1;
      v_cur  := v_cur + 1;
    END LOOP;
  ELSE
    -- Rifiuta le richieste malattia pendenti/approvate collegate
    UPDATE public.time_off_requests
    SET status = 'rejected', reviewed_by = p_validator_id, reviewed_at = now(), updated_at = now()
    WHERE illness_certificate_id = p_certificate_id
      AND status IN ('pending', 'approved');
  END IF;

  RETURN jsonb_build_object('ok', true, 'days_affected', v_days);
END; $$;

-- Inizializza saldo ferie/permessi per un dipendente (anno corrente o specificato)
CREATE OR REPLACE FUNCTION public.initialize_leave_balances(
  p_user_id  uuid,
  p_store_id uuid,
  p_year     integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year         integer;
  v_weekly_h     integer;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM now())::integer);

  SELECT COALESCE(weekly_contract_hours, 40)
  INTO v_weekly_h
  FROM public.employee_details
  WHERE user_id = p_user_id LIMIT 1;

  v_weekly_h := COALESCE(v_weekly_h, 40);

  -- Ferie: 4 settimane di contratto (minimo legale italiano art. 10 D.Lgs. 66/2003).
  -- Formula: weekly_contract_hours × 4 = ore totali ferie annue.
  -- Esempio: 40h/week × 4 = 160h = 20 giorni lavorativi (160h / 8h×g). Corretto.
  INSERT INTO public.employee_leave_balances
    (user_id, store_id, year, leave_type, total_hours, used_hours)
  VALUES
    (p_user_id, p_store_id, v_year, 'ferie',        v_weekly_h * 4.0, 0),
    (p_user_id, p_store_id, v_year, 'permesso',      24.0,             0),
    (p_user_id, p_store_id, v_year, 'permesso_104',   0.0,             0)
  ON CONFLICT (user_id, store_id, year, leave_type) DO NOTHING;
END; $$;

-- Grant esecuzione alle Edge Functions (service_role)
GRANT EXECUTE ON FUNCTION public.approve_time_off_request(uuid, uuid)         TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_time_off_request(uuid, uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_illness_certificate(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.initialize_leave_balances(uuid, uuid, integer) TO service_role;
