-- Notifications system schema

-- Helper: check integer arrays contain only positive, non-null values.
-- Note: Postgres CHECK constraints cannot use subqueries, so this must be a function.
CREATE OR REPLACE FUNCTION public.int_array_all_positive(vals integer[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(MIN(v), 1) > 0
    AND COUNT(*) = COUNT(v)
  FROM unnest(vals) AS v;
$$;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'lesson_upcoming_reminder',
      'lesson_changed',
      'lesson_scheduled_by_teacher',
      'lesson_accepted_or_denied_by_student',
      'lesson_booked_by_student',
      'homework_assigned',
      'homework_due_soon',
      'homework_submitted',
      'message_received',
      'credit_threshold_reached'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_source') THEN
    CREATE TYPE notification_source AS ENUM (
      'lesson',
      'homework',
      'message',
      'credits'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_role') THEN
    CREATE TYPE notification_role AS ENUM (
      'teacher',
      'student'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_event_status') THEN
    CREATE TYPE notification_event_status AS ENUM (
      'new',
      'processed',
      'skipped',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_email_status') THEN
    CREATE TYPE notification_email_status AS ENUM (
      'pending',
      'sending',
      'sent',
      'failed',
      'canceled',
      'skipped'
    );
  END IF;
END $$;

-- Notification type catalog (defaults & UI metadata)
CREATE TABLE IF NOT EXISTS notification_type_catalog (
  notification_type notification_type PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('lessons', 'homework', 'messages', 'credits')),
  allowed_roles notification_role[] NOT NULL,
  supports_timing BOOLEAN NOT NULL DEFAULT false,
  supports_thresholds BOOLEAN NOT NULL DEFAULT false,
  default_in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  default_email_enabled BOOLEAN NOT NULL DEFAULT true,
  default_timing_minutes INTEGER[],
  default_credit_thresholds INTEGER[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_notification_type_catalog_updated_at
  BEFORE UPDATE ON notification_type_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  timing_minutes INTEGER[],
  credit_thresholds INTEGER[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, notification_type),
  CONSTRAINT notification_preferences_timing_positive CHECK (public.int_array_all_positive(timing_minutes)),
  CONSTRAINT notification_preferences_thresholds_positive CHECK (public.int_array_all_positive(credit_thresholds))
);

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Notification events (recipient-scoped occurrences)
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  event_key TEXT NOT NULL,
  source_type notification_source NOT NULL,
  source_id UUID,
  role notification_role NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status notification_event_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_status
  ON notification_events (status, created_at);

-- Email outbox
CREATE TABLE IF NOT EXISTS notification_email_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  notification_type notification_type NOT NULL,
  source_type notification_source NOT NULL,
  source_id UUID,
  role notification_role NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 1,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  cta_url TEXT NOT NULL,
  template_data JSONB,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status notification_email_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_status
  ON notification_email_outbox (status, scheduled_for);

CREATE TRIGGER update_notification_email_outbox_updated_at
  BEFORE UPDATE ON notification_email_outbox
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Extend notifications table for required metadata
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS notification_type notification_type,
  ADD COLUMN IF NOT EXISTS source_type notification_source,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS role notification_role,
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_user_priority_created
  ON notifications (user_id, priority DESC, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_event_key
  ON notifications (user_id, event_key);

-- RLS
ALTER TABLE notification_type_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notification type catalog is readable by all"
  ON notification_type_catalog FOR SELECT USING (true);

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE USING (user_id = auth.uid());

-- Tighten notifications insert policy (service role bypasses RLS)
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Seed catalog defaults
INSERT INTO notification_type_catalog (
  notification_type,
  label,
  category,
  allowed_roles,
  supports_timing,
  supports_thresholds,
  default_in_app_enabled,
  default_email_enabled,
  default_timing_minutes,
  default_credit_thresholds
) VALUES
  ('lesson_upcoming_reminder', 'Upcoming lesson reminder', 'lessons', ARRAY['teacher','student']::notification_role[], true, false, true, true, ARRAY[1440, 60], NULL),
  ('lesson_changed', 'Lesson changed (rescheduled or canceled)', 'lessons', ARRAY['teacher','student']::notification_role[], false, false, true, true, NULL, NULL),
  ('lesson_scheduled_by_teacher', 'New lesson scheduled by teacher', 'lessons', ARRAY['student']::notification_role[], false, false, true, true, NULL, NULL),
  ('lesson_accepted_or_denied_by_student', 'Lesson accepted/denied by student', 'lessons', ARRAY['teacher']::notification_role[], false, false, true, true, NULL, NULL),
  ('lesson_booked_by_student', 'Lesson booked by student', 'lessons', ARRAY['teacher']::notification_role[], false, false, true, true, NULL, NULL),
  ('homework_assigned', 'Homework assigned', 'homework', ARRAY['student']::notification_role[], false, false, true, true, NULL, NULL),
  ('homework_due_soon', 'Homework due soon', 'homework', ARRAY['student']::notification_role[], true, false, true, true, ARRAY[1440], NULL),
  ('homework_submitted', 'Homework submitted', 'homework', ARRAY['teacher']::notification_role[], false, false, true, true, NULL, NULL),
  ('message_received', 'New message', 'messages', ARRAY['teacher','student']::notification_role[], false, false, true, true, NULL, NULL),
  ('credit_threshold_reached', 'Credit threshold reached', 'credits', ARRAY['teacher','student']::notification_role[], false, true, true, true, NULL, ARRAY[2, 1])
ON CONFLICT (notification_type) DO NOTHING;
