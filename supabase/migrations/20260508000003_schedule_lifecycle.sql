-- ============================================================
-- FASE 2: Schedule lifecycle, schedule_versions, validation fields
-- Date: 2026-05-08
-- ============================================================

-- ─── 1. Extend generation_runs with lifecycle fields ────────────────────────

ALTER TABLE public.generation_runs
  ADD COLUMN IF NOT EXISTS lifecycle_status text
    DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft','generated','validated','published','modified','archived')),
  ADD COLUMN IF NOT EXISTS validation_result     jsonb,
  ADD COLUMN IF NOT EXISTS quality_score         numeric(5,2),
  ADD COLUMN IF NOT EXISTS validated_at          timestamptz,
  ADD COLUMN IF NOT EXISTS modified_at           timestamptz;

-- Backfill existing rows: completed runs → 'generated', published runs → 'published'
UPDATE public.generation_runs
SET lifecycle_status = CASE
  WHEN status = 'published' THEN 'published'
  WHEN status IN ('completed') THEN 'generated'
  WHEN status = 'failed' THEN 'archived'
  ELSE 'draft'
END
WHERE lifecycle_status = 'draft';

-- ─── 2. schedule_versions — snapshot history ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_versions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  week_start       date        NOT NULL,
  version_number   integer     NOT NULL DEFAULT 1,
  lifecycle_status text        NOT NULL DEFAULT 'generated'
    CHECK (lifecycle_status IN ('draft','generated','validated','published','modified','archived')),
  shifts_snapshot  jsonb       NOT NULL DEFAULT '[]',
  quality_score    numeric(5,2),
  validation_result jsonb,
  hard_violations  integer     NOT NULL DEFAULT 0,
  soft_warnings    integer     NOT NULL DEFAULT 0,
  generation_run_id uuid       REFERENCES public.generation_runs(id) ON DELETE SET NULL,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one version number per store+week combination
CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_versions_store_week_version
  ON public.schedule_versions (store_id, week_start, version_number);

-- Fast lookups by store and week
CREATE INDEX IF NOT EXISTS idx_schedule_versions_store_week
  ON public.schedule_versions (store_id, week_start DESC);

-- RLS
ALTER TABLE public.schedule_versions ENABLE ROW LEVEL SECURITY;

-- Managers can read/write versions for their stores
DROP POLICY IF EXISTS "schedule_versions_manager_select" ON public.schedule_versions;
CREATE POLICY "schedule_versions_manager_select"
  ON public.schedule_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_store_assignments usa
      JOIN public.user_roles ur ON ur.user_id = usa.user_id
      WHERE usa.user_id = auth.uid()
        AND usa.store_id = schedule_versions.store_id
        AND ur.role IN ('super_admin','admin','store_manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "schedule_versions_manager_insert" ON public.schedule_versions;
CREATE POLICY "schedule_versions_manager_insert"
  ON public.schedule_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_store_assignments usa
      JOIN public.user_roles ur ON ur.user_id = usa.user_id
      WHERE usa.user_id = auth.uid()
        AND usa.store_id = schedule_versions.store_id
        AND ur.role IN ('super_admin','admin','store_manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- Service role (Edge Functions) can do anything — bypasses RLS automatically.

-- ─── 3. Helper function: create a new version snapshot ──────────────────────

CREATE OR REPLACE FUNCTION public.create_schedule_version(
  p_store_id         uuid,
  p_week_start       date,
  p_lifecycle_status text,
  p_shifts_snapshot  jsonb,
  p_quality_score    numeric,
  p_validation_result jsonb,
  p_hard_violations  integer,
  p_soft_warnings    integer,
  p_generation_run_id uuid DEFAULT NULL,
  p_created_by       uuid DEFAULT NULL,
  p_note             text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_version integer;
  v_id uuid;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next_version
    FROM public.schedule_versions
   WHERE store_id = p_store_id AND week_start = p_week_start;

  INSERT INTO public.schedule_versions (
    store_id, week_start, version_number, lifecycle_status,
    shifts_snapshot, quality_score, validation_result,
    hard_violations, soft_warnings, generation_run_id, created_by, note
  ) VALUES (
    p_store_id, p_week_start, v_next_version, p_lifecycle_status,
    p_shifts_snapshot, p_quality_score, p_validation_result,
    p_hard_violations, p_soft_warnings, p_generation_run_id, p_created_by, p_note
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── 4. Index on shifts for faster lifecycle queries ────────────────────────

CREATE INDEX IF NOT EXISTS idx_shifts_store_week_status
  ON public.shifts (store_id, date, status)
  WHERE status IN ('draft','published');
