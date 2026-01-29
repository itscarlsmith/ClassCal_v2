-- Provide a config table fallback for pg_net dispatch.
-- Supabase often restricts ALTER DATABASE ... SET app.* (custom GUCs), so this
-- table allows managing dispatch URL/secret via normal SQL.

CREATE TABLE IF NOT EXISTS notification_dispatch_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  dispatch_url TEXT,
  dispatch_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_dispatch_config_singleton CHECK (id = 1)
);

CREATE TRIGGER update_notification_dispatch_config_updated_at
  BEFORE UPDATE ON notification_dispatch_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO notification_dispatch_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE notification_dispatch_config ENABLE ROW LEVEL SECURITY;

-- Update dispatcher to fall back to config table when app.* settings are unavailable
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
    SELECT c.dispatch_url, c.dispatch_secret
      INTO dispatch_url, dispatch_secret
    FROM notification_dispatch_config c
    WHERE c.id = 1;
  END IF;

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

