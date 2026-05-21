-- Configura pg_cron per generare turni mensili ogni 25 del mese alle 09:00 UTC.
-- La edge function cron-generate-shifts ha verify_jwt = false → nessuna chiave da embeddare.

-- Rimuovi job precedente se esiste (idempotenza)
SELECT cron.unschedule('monthly-generate-shifts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monthly-generate-shifts'
);

-- Crea il cron job: chiama la edge function via pg_net
SELECT cron.schedule(
  'monthly-generate-shifts',
  '0 9 25 * *',
  $$
  SELECT net.http_post(
    url     := 'https://hzcnvfqbbzkqyvolokvt.supabase.co/functions/v1/cron-generate-shifts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
