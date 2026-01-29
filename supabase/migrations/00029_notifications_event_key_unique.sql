-- Fix notifications ON CONFLICT inference.
-- Earlier versions used a partial unique index (WHERE event_key IS NOT NULL), which
-- Postgres will not infer for ON CONFLICT (user_id, event_key).

DROP INDEX IF EXISTS idx_notifications_user_event_key;
CREATE UNIQUE INDEX idx_notifications_user_event_key
  ON notifications (user_id, event_key);

