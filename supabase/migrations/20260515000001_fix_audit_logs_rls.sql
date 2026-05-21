-- Fix: audit_logs visibile solo a super_admin
-- Admin e store_manager NON devono vedere i log di audit (spec ROLES_AND_PERMISSIONS.md)

DROP POLICY IF EXISTS "Admin reads store audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Store manager reads store audit_logs" ON public.audit_logs;
