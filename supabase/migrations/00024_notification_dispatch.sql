-- Dispatch notification events into in-app notifications and email outbox

CREATE OR REPLACE FUNCTION dispatch_notification_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  catalog notification_type_catalog%ROWTYPE;
  pref notification_preferences%ROWTYPE;
  resolved_in_app BOOLEAN;
  resolved_email BOOLEAN;
  resolved_timing INTEGER[];
  resolved_thresholds INTEGER[];
  payload JSONB := COALESCE(NEW.payload, '{}'::jsonb);
  title TEXT;
  message TEXT;
  subject TEXT;
  body TEXT;
  cta_url TEXT;
  recipient_email TEXT;
  minutes_before INTEGER;
  threshold_value INTEGER;
BEGIN
  SELECT * INTO catalog
  FROM notification_type_catalog
  WHERE notification_type = NEW.notification_type;

  IF NOT FOUND THEN
    UPDATE notification_events
      SET status = 'failed',
          processed_at = NOW(),
          last_error = 'Missing notification_type_catalog entry'
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT * INTO pref
  FROM notification_preferences
  WHERE user_id = NEW.user_id
    AND notification_type = NEW.notification_type;

  resolved_in_app := COALESCE(pref.in_app_enabled, catalog.default_in_app_enabled);
  resolved_email := COALESCE(pref.email_enabled, catalog.default_email_enabled);
  resolved_timing := COALESCE(pref.timing_minutes, catalog.default_timing_minutes);
  resolved_thresholds := COALESCE(pref.credit_thresholds, catalog.default_credit_thresholds);

  IF NOT (NEW.role = ANY(catalog.allowed_roles)) THEN
    UPDATE notification_events
      SET status = 'skipped',
          processed_at = NOW(),
          last_error = 'Role not allowed'
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF catalog.supports_timing THEN
    IF payload ? 'minutes_before' THEN
      minutes_before := (payload->>'minutes_before')::INTEGER;
      IF resolved_timing IS NULL OR NOT (minutes_before = ANY(resolved_timing)) THEN
        resolved_in_app := false;
        resolved_email := false;
      END IF;
    ELSE
      resolved_in_app := false;
      resolved_email := false;
    END IF;
  END IF;

  IF catalog.supports_thresholds THEN
    IF payload ? 'threshold' THEN
      threshold_value := (payload->>'threshold')::INTEGER;
      IF resolved_thresholds IS NULL OR NOT (threshold_value = ANY(resolved_thresholds)) THEN
        resolved_in_app := false;
        resolved_email := false;
      END IF;
    ELSE
      resolved_in_app := false;
      resolved_email := false;
    END IF;
  END IF;

  IF NOT resolved_in_app AND NOT resolved_email THEN
    UPDATE notification_events
      SET status = 'skipped',
          processed_at = NOW(),
          last_error = 'Channels disabled'
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  title := COALESCE(payload->>'title', catalog.label);
  message := COALESCE(payload->>'message', '');

  IF resolved_in_app THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      is_read,
      data,
      notification_type,
      source_type,
      source_id,
      role,
      priority,
      event_key
    ) VALUES (
      NEW.user_id,
      NEW.notification_type::TEXT,
      title,
      message,
      false,
      payload,
      NEW.notification_type,
      NEW.source_type,
      NEW.source_id,
      NEW.role,
      NEW.priority,
      NEW.event_key
    )
    ON CONFLICT (user_id, event_key) DO NOTHING;
  END IF;

  IF resolved_email THEN
    SELECT email INTO recipient_email
    FROM profiles
    WHERE id = NEW.user_id;

    IF recipient_email IS NOT NULL THEN
      subject := COALESCE(payload->>'email_subject', title);
      body := COALESCE(payload->>'email_body', message);
      cta_url := COALESCE(NULLIF(payload->>'cta_url', ''), NULLIF(payload->>'href', ''), '/');

      INSERT INTO notification_email_outbox (
        user_id,
        event_key,
        notification_type,
        source_type,
        source_id,
        role,
        priority,
        to_email,
        subject,
        text_body,
        cta_url,
        template_data,
        scheduled_for
      ) VALUES (
        NEW.user_id,
        NEW.event_key,
        NEW.notification_type,
        NEW.source_type,
        NEW.source_id,
        NEW.role,
        NEW.priority,
        recipient_email,
        subject,
        body,
        cta_url,
        payload,
        CASE
          WHEN payload ? 'scheduled_for' THEN (payload->>'scheduled_for')::timestamptz
          ELSE NOW()
        END
      )
      ON CONFLICT (user_id, event_key) DO NOTHING;
    END IF;
  END IF;

  UPDATE notification_events
    SET status = 'processed',
        processed_at = NOW()
    WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    UPDATE notification_events
      SET status = 'failed',
          processed_at = NOW(),
          last_error = SQLERRM
      WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_dispatch_notification_event ON notification_events;
CREATE TRIGGER trigger_dispatch_notification_event
  AFTER INSERT ON notification_events
  FOR EACH ROW EXECUTE FUNCTION dispatch_notification_event();
