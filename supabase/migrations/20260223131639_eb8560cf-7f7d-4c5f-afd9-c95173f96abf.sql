-- Restore missing profile for the Google-authenticated user
INSERT INTO public.profiles (id, full_name, email)
SELECT 
  '92543195-7735-4ada-a5a8-7f1b74cd18c4',
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  COALESCE(email, '')
FROM auth.users
WHERE id = '92543195-7735-4ada-a5a8-7f1b74cd18c4'
ON CONFLICT (id) DO NOTHING;