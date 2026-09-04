-- Schedules the weekly-parent-digest Edge Function via pg_cron + pg_net.
-- The x-cron-secret header value is pulled from Supabase Vault by name at
-- run time (vault.decrypted_secrets), never embedded here -- the actual
-- secret was stored separately via `select vault.create_secret(...)` and is
-- not committed to this repo.
--
-- Schedule: Mondays at 06:00 UTC (08:00 SAST) -- adjust the cron expression
-- below if a different day/time is preferred; see `select * from
-- cron.job` to find this job afterwards, and `cron.unschedule('weekly-parent-digest')`
-- to remove it.
select cron.schedule(
  'weekly-parent-digest',
  '0 6 * * 1',
  $$
  select net.http_post(
    url := 'https://dzphkuzhdpzawhucmjzh.supabase.co/functions/v1/weekly-parent-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_digest_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
