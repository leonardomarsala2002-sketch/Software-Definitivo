-- ============================================================
-- Rate limiting table for Edge Functions
-- Date: 2026-05-08
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL,           -- e.g. "publish-shifts:user_id:store_id"
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast window queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_key_created
  ON public.rate_limit_log (key, created_at DESC);

-- Enable RLS — only service role (Edge Functions) can write
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT via client — all access is through service role which bypasses RLS
-- This table is write-only via Edge Functions using service role key

-- Auto-cleanup: rows older than 1 day are stale, cron will purge them.
-- For now we rely on the TTL check in application logic.
