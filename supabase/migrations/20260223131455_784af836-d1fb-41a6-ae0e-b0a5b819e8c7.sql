-- Restore the missing profile for the super_admin user
INSERT INTO public.profiles (id, full_name, email)
SELECT 
  '92543195-f638-4212-ad16-d75e28fc4063',
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  COALESCE(email, '')
FROM auth.users
WHERE id = '92543195-f638-4212-ad16-d75e28fc4063'
ON CONFLICT (id) DO NOTHING;