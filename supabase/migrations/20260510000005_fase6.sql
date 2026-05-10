-- FASE 6: Integrazioni future — Google Calendar + ZConnect Time Tracking
-- Entrambi i moduli sono opzionali e feature-flaggati.
-- Il sistema funziona normalmente senza le env var configurate.

-- ─── Google Calendar Appointments ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_appointments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id        UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  google_event_id TEXT,                  -- NULL se Google Calendar non configurato
  type            TEXT        NOT NULL CHECK (type IN ('shift', 'time_off', 'holiday')),
  title           TEXT        NOT NULL,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  synced_at       TIMESTAMPTZ,           -- NULL = mai sincronizzato
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_appointments_user
  ON calendar_appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_appointments_store
  ON calendar_appointments(store_id, start_at);

ALTER TABLE calendar_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee sees own calendar appointments"
  ON calendar_appointments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Manager sees all store calendar appointments"
  ON calendar_appointments FOR SELECT
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'store_manager')
  );

CREATE POLICY "Service role manages calendar appointments"
  ON calendar_appointments FOR ALL
  USING (auth.role() = 'service_role');

-- ─── ZConnect / Time Tracking Demo Entries ────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_tracking_demo_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id    UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shift_id    UUID        REFERENCES shifts(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL CHECK (type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo     BOOLEAN     NOT NULL DEFAULT true,   -- false quando ZConnect reale è connesso
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_tracking_employee
  ON time_tracking_demo_entries(employee_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_time_tracking_store
  ON time_tracking_demo_entries(store_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_time_tracking_shift
  ON time_tracking_demo_entries(shift_id);

ALTER TABLE time_tracking_demo_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee sees own time tracking entries"
  ON time_tracking_demo_entries FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Manager sees all store time tracking entries"
  ON time_tracking_demo_entries FOR SELECT
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'store_manager')
  );

CREATE POLICY "Service role manages time tracking entries"
  ON time_tracking_demo_entries FOR ALL
  USING (auth.role() = 'service_role');
