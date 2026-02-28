
-- Drop all restrictive policies on store_rules
DROP POLICY IF EXISTS "Admin manages own store_rules" ON public.store_rules;
DROP POLICY IF EXISTS "Employee reads own store_rules" ON public.store_rules;
DROP POLICY IF EXISTS "Super admin full access store_rules" ON public.store_rules;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Super admin full access store_rules"
ON public.store_rules FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manages own store_rules"
ON public.store_rules FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_store_member(auth.uid(), store_id));

CREATE POLICY "Employee reads own store_rules"
ON public.store_rules FOR SELECT TO authenticated
USING (is_store_member(auth.uid(), store_id));
