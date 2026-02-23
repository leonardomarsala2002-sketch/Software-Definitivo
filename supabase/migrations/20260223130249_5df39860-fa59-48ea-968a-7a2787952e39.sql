-- Restore super_admin role for the user
INSERT INTO public.user_roles (user_id, role)
VALUES ('92543195-7735-4ada-a5a8-7f1b74cd18c4', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- Restore primary store assignment
INSERT INTO public.user_store_assignments (user_id, store_id, is_primary)
VALUES ('92543195-7735-4ada-a5a8-7f1b74cd18c4', 'a0000001-0000-0000-0000-000000000001', true)
ON CONFLICT (user_id, store_id) DO UPDATE SET is_primary = true;

NOTIFY pgrst, 'reload schema';