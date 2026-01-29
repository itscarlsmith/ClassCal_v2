-- Email dispatch via pg_net -> Next.js internal route

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION dispatch_notification_email_outbox()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dispatch_url TEXT := current_setting('app.notifications_dispatch_url', true);
  dispatch_secret TEXT := current_setting('app.notifications_dispatch_secret', true);
BEGIN
  IF dispatch_url IS NULL OR dispatch_secret IS NULL THEN
    RAISE WARNING 'Notification dispatch URL/secret not configured';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := dispatch_url,
    headers := jsonb_build_object(
      'x-notifications-secret', dispatch_secret,
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.unschedule('dispatch_notification_email_outbox') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'dispatch_notification_email_outbox'
);

SELECT cron.schedule(
  'dispatch_notification_email_outbox',
  '* * * * *',
  'SELECT dispatch_notification_email_outbox();'
);
