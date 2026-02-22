
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  store_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admin can read all
CREATE POLICY "Super admin reads all audit_logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin reads own store
CREATE POLICY "Admin reads store audit_logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

-- Service role inserts (via edge functions / triggers)
CREATE POLICY "Service inserts audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_audit_logs_store_created ON public.audit_logs (store_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
