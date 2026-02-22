
-- Replace overly permissive INSERT policy with service-role-only insert
-- The service role bypasses RLS anyway, so we restrict regular users
DROP POLICY "Service inserts audit_logs" ON public.audit_logs;

-- Only super_admin/admin can insert (edge functions use service role which bypasses RLS)
CREATE POLICY "Admin inserts audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
  );
