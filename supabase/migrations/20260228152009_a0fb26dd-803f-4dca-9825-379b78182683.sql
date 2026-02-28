
-- Assign to all stores (use DO NOTHING with the correct constraint)
INSERT INTO public.user_store_assignments (user_id, store_id, is_primary)
VALUES 
  ('92543195-7735-4ada-a5a8-7f1b74cd18c4', 'a0000001-0000-0000-0000-000000000001', true),
  ('92543195-7735-4ada-a5a8-7f1b74cd18c4', 'a0000001-0000-0000-0000-000000000002', false),
  ('92543195-7735-4ada-a5a8-7f1b74cd18c4', 'a0000001-0000-0000-0000-000000000003', false)
ON CONFLICT ON CONSTRAINT user_store_assignments_user_id_store_id_key DO NOTHING;
