
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule shift generation every Thursday at 00:00 UTC
SELECT cron.schedule(
  'weekly-shift-generation',
  '0 0 * * 4',
  $$
  SELECT net.http_post(
    url := 'https://hzcnvfqbbzkqyvolokvt.supabase.co/functions/v1/cron-generate-shifts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6Y252ZnFiYnprcXl2b2xva3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTA4MzUsImV4cCI6MjA4NzE4NjgzNX0.ONAGYoMOkaR0uKI0pHpjKrjhdT7vmJyOEdmpP58pQZ0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
