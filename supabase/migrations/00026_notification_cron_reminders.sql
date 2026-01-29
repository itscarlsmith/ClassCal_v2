-- Time-based notification emitters

CREATE OR REPLACE FUNCTION notify_lesson_reminders_minutely()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_acquired BOOLEAN;
BEGIN
  lock_acquired := pg_try_advisory_lock(915001);
  IF NOT lock_acquired THEN
    RETURN;
  END IF;

  WITH catalog AS (
    SELECT *
    FROM notification_type_catalog
    WHERE notification_type = 'lesson_upcoming_reminder'
  ),
  candidates AS (
    SELECT
      l.id AS lesson_id,
      l.teacher_id,
      l.student_id,
      l.title AS lesson_title,
      l.start_time,
      t.minutes_before,
      date_trunc('minute', l.start_time - make_interval(mins => t.minutes_before)) AS send_at
    FROM lessons l
    CROSS JOIN (VALUES (60), (1440)) AS t(minutes_before)
    WHERE l.status IN ('pending', 'confirmed')
      AND date_trunc('minute', l.start_time - make_interval(mins => t.minutes_before)) = date_trunc('minute', NOW())
  )
  INSERT INTO notification_events (
    user_id,
    notification_type,
    event_key,
    source_type,
    source_id,
    role,
    priority,
    payload
  )
  SELECT
    s.user_id,
    'lesson_upcoming_reminder',
    'lesson:' || c.lesson_id::TEXT || ':reminder:' || c.minutes_before::TEXT || ':at:' || c.send_at::TEXT,
    'lesson',
    c.lesson_id,
    'student',
    CASE WHEN c.minutes_before = 60 THEN 3 ELSE 2 END,
    jsonb_build_object(
      'href', '/student/lessons?lesson=' || c.lesson_id::TEXT,
      'title', 'Lesson reminder',
      'message', 'Lesson with ' || COALESCE(tp.full_name, 'your teacher')
        || ' starts in ' || c.minutes_before::TEXT || ' minutes',
      'email_subject', 'Lesson reminder',
      'email_body', 'Lesson with ' || COALESCE(tp.full_name, 'your teacher')
        || ' starts in ' || c.minutes_before::TEXT || ' minutes',
      'minutes_before', c.minutes_before,
      'lesson_id', c.lesson_id,
      'start_time', c.start_time
    )
  FROM candidates c
  JOIN students s ON s.id = c.student_id
  JOIN profiles tp ON tp.id = c.teacher_id
  CROSS JOIN catalog nc
  LEFT JOIN notification_preferences np
    ON np.user_id = s.user_id
   AND np.notification_type = 'lesson_upcoming_reminder'
  WHERE s.user_id IS NOT NULL
    AND (
      COALESCE(np.in_app_enabled, nc.default_in_app_enabled)
      OR COALESCE(np.email_enabled, nc.default_email_enabled)
    )
    AND (
      COALESCE(np.timing_minutes, nc.default_timing_minutes) @> ARRAY[c.minutes_before]
    )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  INSERT INTO notification_events (
    user_id,
    notification_type,
    event_key,
    source_type,
    source_id,
    role,
    priority,
    payload
  )
  SELECT
    c.teacher_id,
    'lesson_upcoming_reminder',
    'lesson:' || c.lesson_id::TEXT || ':reminder:' || c.minutes_before::TEXT || ':at:' || c.send_at::TEXT,
    'lesson',
    c.lesson_id,
    'teacher',
    CASE WHEN c.minutes_before = 60 THEN 3 ELSE 2 END,
    jsonb_build_object(
      'href', '/teacher/lessons?lesson=' || c.lesson_id::TEXT,
      'title', 'Lesson reminder',
      'message', 'Lesson with ' || COALESCE(sp.full_name, 'your student')
        || ' starts in ' || c.minutes_before::TEXT || ' minutes',
      'email_subject', 'Lesson reminder',
      'email_body', 'Lesson with ' || COALESCE(sp.full_name, 'your student')
        || ' starts in ' || c.minutes_before::TEXT || ' minutes',
      'minutes_before', c.minutes_before,
      'lesson_id', c.lesson_id,
      'start_time', c.start_time
    )
  FROM candidates c
  JOIN students sp ON sp.id = c.student_id
  CROSS JOIN catalog nc
  LEFT JOIN notification_preferences np
    ON np.user_id = c.teacher_id
   AND np.notification_type = 'lesson_upcoming_reminder'
  WHERE c.teacher_id IS NOT NULL
    AND (
      COALESCE(np.in_app_enabled, nc.default_in_app_enabled)
      OR COALESCE(np.email_enabled, nc.default_email_enabled)
    )
    AND (
      COALESCE(np.timing_minutes, nc.default_timing_minutes) @> ARRAY[c.minutes_before]
    )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  PERFORM pg_advisory_unlock(915001);
END;
$$;

CREATE OR REPLACE FUNCTION notify_homework_due_soon_minutely()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_acquired BOOLEAN;
  minutes_before INTEGER := 1440;
BEGIN
  lock_acquired := pg_try_advisory_lock(915002);
  IF NOT lock_acquired THEN
    RETURN;
  END IF;

  WITH catalog AS (
    SELECT *
    FROM notification_type_catalog
    WHERE notification_type = 'homework_due_soon'
  ),
  candidates AS (
    SELECT
      h.id AS homework_id,
      h.teacher_id,
      h.student_id,
      h.title AS homework_title,
      h.due_date,
      date_trunc('minute', h.due_date - make_interval(mins => minutes_before)) AS send_at
    FROM homework h
    WHERE h.status IN ('assigned', 'needs_revision', 'overdue')
      AND date_trunc('minute', h.due_date - make_interval(mins => minutes_before)) = date_trunc('minute', NOW())
  )
  INSERT INTO notification_events (
    user_id,
    notification_type,
    event_key,
    source_type,
    source_id,
    role,
    priority,
    payload
  )
  SELECT
    s.user_id,
    'homework_due_soon',
    'homework:' || c.homework_id::TEXT || ':due_soon:at:' || c.send_at::TEXT,
    'homework',
    c.homework_id,
    'student',
    2,
    jsonb_build_object(
      'href', '/student/homework?homework=' || c.homework_id::TEXT,
      'title', 'Homework due soon',
      'message', 'Homework "' || COALESCE(c.homework_title, 'assignment')
        || '" is due soon',
      'email_subject', 'Homework due soon',
      'email_body', 'Homework "' || COALESCE(c.homework_title, 'assignment')
        || '" is due soon',
      'minutes_before', minutes_before,
      'homework_id', c.homework_id,
      'due_date', c.due_date
    )
  FROM candidates c
  JOIN students s ON s.id = c.student_id
  CROSS JOIN catalog nc
  LEFT JOIN notification_preferences np
    ON np.user_id = s.user_id
   AND np.notification_type = 'homework_due_soon'
  WHERE s.user_id IS NOT NULL
    AND (
      COALESCE(np.in_app_enabled, nc.default_in_app_enabled)
      OR COALESCE(np.email_enabled, nc.default_email_enabled)
    )
    AND (
      COALESCE(np.timing_minutes, nc.default_timing_minutes) @> ARRAY[minutes_before]
    )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  PERFORM pg_advisory_unlock(915002);
END;
$$;

-- Cron schedules
SELECT cron.unschedule('notify_lesson_reminders_minutely') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notify_lesson_reminders_minutely'
);

SELECT cron.schedule(
  'notify_lesson_reminders_minutely',
  '* * * * *',
  'SELECT notify_lesson_reminders_minutely();'
);

SELECT cron.unschedule('notify_homework_due_soon_minutely') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notify_homework_due_soon_minutely'
);

SELECT cron.schedule(
  'notify_homework_due_soon_minutely',
  '* * * * *',
  'SELECT notify_homework_due_soon_minutely();'
);
