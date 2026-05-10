-- ============================================================
-- FASE 1 — RBAC, Multi-store isolation, DB cleanup
-- Date: 2026-05-08
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Add store_manager to app_role enum
-- ────────────────────────────────────────────────────────────
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in PG < 12.
-- Supabase runs migrations in a transaction by default; Supabase Cloud
-- uses PG 15+ which supports ALTER TYPE ADD VALUE in transactions.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'store_manager';

-- ────────────────────────────────────────────────────────────
-- 2. Add store_id to employee_details (multi-store isolation)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.employee_details
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Backfill from primary user_store_assignment
UPDATE public.employee_details ed
SET store_id = (
  SELECT usa.store_id
  FROM public.user_store_assignments usa
  WHERE usa.user_id = ed.user_id
    AND usa.is_primary = true
  LIMIT 1
)
WHERE ed.store_id IS NULL;

-- Index for store-filtered queries
CREATE INDEX IF NOT EXISTS idx_employee_details_store_id
  ON public.employee_details (store_id);

-- ────────────────────────────────────────────────────────────
-- 3. Add missing FK on time_off_requests.store_id
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.time_off_requests
    ADD CONSTRAINT fk_time_off_requests_store_id
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists, skip
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. Enhance audit_logs with missing fields
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS session_id  text,
  ADD COLUMN IF NOT EXISTS user_agent  text,
  ADD COLUMN IF NOT EXISTS role        text;

COMMENT ON COLUMN public.audit_logs.role IS 'Role of the user at the time of the action';
COMMENT ON COLUMN public.audit_logs.session_id IS 'Browser/client session identifier';
COMMENT ON COLUMN public.audit_logs.user_agent IS 'HTTP User-Agent header from the request';

-- ────────────────────────────────────────────────────────────
-- 5. Helper function: is_manager_or_above
--    Returns true for super_admin, admin, store_manager
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'store_manager')
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 6. RLS policies for store_manager
--    Strategy: ADD new policies (PostgreSQL evaluates them with OR).
--    Existing admin/super_admin policies are untouched.
-- ────────────────────────────────────────────────────────────

-- 6a. shifts
DROP POLICY IF EXISTS "Store manager manages own store shifts" ON public.shifts;
CREATE POLICY "Store manager manages own store shifts" ON public.shifts
  FOR ALL
  USING (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  );

-- 6b. time_off_requests
DROP POLICY IF EXISTS "Store manager manages store requests" ON public.time_off_requests;
CREATE POLICY "Store manager manages store requests" ON public.time_off_requests
  FOR ALL
  USING (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  );

-- 6c. generation_runs
DROP POLICY IF EXISTS "Store manager reads own store generation_runs" ON public.generation_runs;
CREATE POLICY "Store manager reads own store generation_runs" ON public.generation_runs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  );

-- 6d. store_rules
DROP POLICY IF EXISTS "Store manager reads own store_rules" ON public.store_rules;
CREATE POLICY "Store manager reads own store_rules" ON public.store_rules
  FOR SELECT
  USING (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  );

-- 6e. opening_hours (condizionale: la tabella potrebbe non esistere)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'opening_hours') THEN
    DROP POLICY IF EXISTS "Store manager reads own opening_hours" ON public.opening_hours;
    EXECUTE $p$
      CREATE POLICY "Store manager reads own opening_hours" ON public.opening_hours
        FOR SELECT USING (
          has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
        )
    $p$;
  END IF;
END $$;

-- 6f. store_coverage_requirements
DROP POLICY IF EXISTS "Store manager reads own coverage" ON public.store_coverage_requirements;
CREATE POLICY "Store manager reads own coverage" ON public.store_coverage_requirements
  FOR SELECT
  USING (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  );

-- 6g. employee_details
--     Uses store_id column added in step 2 (when populated).
--     Falls back to the existing join-based admin policy for records still missing store_id.
DROP POLICY IF EXISTS "Store manager reads store employee_details" ON public.employee_details;
CREATE POLICY "Store manager reads store employee_details" ON public.employee_details
  FOR SELECT
  USING (
    has_role(auth.uid(), 'store_manager') AND (
      -- Prefer direct store_id match
      (store_id IS NOT NULL AND is_store_member(auth.uid(), store_id))
      OR
      -- Fallback: check via user_store_assignments join
      EXISTS (
        SELECT 1
        FROM public.user_store_assignments usa1
        JOIN public.user_store_assignments usa2
          ON usa1.store_id = usa2.store_id
        WHERE usa1.user_id = auth.uid()
          AND usa2.user_id = employee_details.user_id
      )
    )
  );

-- 6h. notifications
DROP POLICY IF EXISTS "Store manager reads own store notifications" ON public.notifications;
CREATE POLICY "Store manager reads own store notifications" ON public.notifications
  FOR SELECT
  USING (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  );

-- 6i. audit_logs
DROP POLICY IF EXISTS "Store manager reads store audit_logs" ON public.audit_logs;
CREATE POLICY "Store manager reads store audit_logs" ON public.audit_logs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  );

-- 6j. invitations
DROP POLICY IF EXISTS "Store manager manages own store invitations" ON public.invitations;
CREATE POLICY "Store manager manages own store invitations" ON public.invitations
  FOR ALL
  USING (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  );

-- 6k. profiles — store manager reads colleagues in same store
DROP POLICY IF EXISTS "Store manager reads store colleague profiles" ON public.profiles;
CREATE POLICY "Store manager reads store colleague profiles" ON public.profiles
  FOR SELECT
  USING (
    has_role(auth.uid(), 'store_manager') AND EXISTS (
      SELECT 1
      FROM public.user_store_assignments usa1
      JOIN public.user_store_assignments usa2
        ON usa1.store_id = usa2.store_id
      WHERE usa1.user_id = auth.uid()
        AND usa2.user_id = profiles.id
    )
  );

-- 6l. user_store_assignments — store manager reads assignments in their store
DROP POLICY IF EXISTS "Store manager reads store assignments" ON public.user_store_assignments;
CREATE POLICY "Store manager reads store assignments" ON public.user_store_assignments
  FOR SELECT
  USING (
    has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
  );

-- 6m. allowed_times (condizionale: la tabella potrebbe non esistere)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'allowed_times') THEN
    DROP POLICY IF EXISTS "Store manager reads own allowed_times" ON public.allowed_times;
    EXECUTE $p$
      CREATE POLICY "Store manager reads own allowed_times" ON public.allowed_times
        FOR SELECT USING (
          has_role(auth.uid(), 'store_manager') AND is_store_member(auth.uid(), store_id)
        )
    $p$;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 7. employee_availability: store manager access
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Store manager reads store availability" ON public.employee_availability;
CREATE POLICY "Store manager reads store availability" ON public.employee_availability
  FOR SELECT
  USING (
    has_role(auth.uid(), 'store_manager') AND EXISTS (
      SELECT 1
      FROM public.user_store_assignments usa
      WHERE usa.user_id = employee_availability.user_id
        AND is_store_member(auth.uid(), usa.store_id)
    )
  );

-- ────────────────────────────────────────────────────────────
-- 8. Additional index for faster store-scoped audit log queries
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs (user_id, created_at DESC);
