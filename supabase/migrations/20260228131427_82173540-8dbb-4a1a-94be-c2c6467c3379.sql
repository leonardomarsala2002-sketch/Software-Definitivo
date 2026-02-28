-- Allow admins to read roles of users in their stores
CREATE POLICY "Admin reads store member roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM user_store_assignments usa1
    JOIN user_store_assignments usa2 ON usa1.store_id = usa2.store_id
    WHERE usa1.user_id = auth.uid() AND usa2.user_id = user_roles.user_id
  )
);