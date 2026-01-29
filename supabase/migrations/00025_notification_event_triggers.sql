-- Notification event emitters for DB-side sources

-- Messages: new message received
CREATE OR REPLACE FUNCTION notify_message_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_role notification_role;
  sender_name TEXT;
  recipient_role_raw TEXT;
  href TEXT;
  student_id UUID;
  title TEXT;
  message TEXT;
BEGIN
  IF NEW.recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO recipient_role_raw
  FROM profiles
  WHERE id = NEW.recipient_id;

  IF recipient_role_raw NOT IN ('teacher', 'student') THEN
    RETURN NEW;
  END IF;

  recipient_role := recipient_role_raw::notification_role;

  SELECT full_name INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  IF recipient_role = 'student' THEN
    href := '/student/messages?teacher=' || NEW.sender_id::TEXT;
  ELSE
    SELECT id INTO student_id
    FROM students
    WHERE user_id = NEW.sender_id
      AND teacher_id = NEW.recipient_id
    ORDER BY created_at
    LIMIT 1;

    IF student_id IS NOT NULL THEN
      href := '/teacher/messages?student=' || student_id::TEXT;
    ELSE
      href := '/teacher/messages';
    END IF;
  END IF;

  title := 'New message';
  message := 'New message from ' || COALESCE(sender_name, 'your contact');

  INSERT INTO notification_events (
    user_id,
    notification_type,
    event_key,
    source_type,
    source_id,
    role,
    priority,
    payload
  ) VALUES (
    NEW.recipient_id,
    'message_received',
    'message:' || NEW.id::TEXT || ':received:' || NEW.created_at::TEXT,
    'message',
    NEW.id,
    recipient_role,
    3,
    jsonb_build_object(
      'href', href,
      'title', title,
      'message', message,
      'email_subject', title,
      'email_body', message
    )
  )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_message_received ON messages;
CREATE TRIGGER trigger_message_received
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_message_received();

-- Homework: assigned to student
CREATE OR REPLACE FUNCTION notify_homework_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_user_id UUID;
  teacher_name TEXT;
  title TEXT;
  message TEXT;
  href TEXT;
BEGIN
  SELECT user_id INTO student_user_id
  FROM students
  WHERE id = NEW.student_id;

  IF student_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO teacher_name
  FROM profiles
  WHERE id = NEW.teacher_id;

  title := 'Homework assigned';
  message := 'New homework from ' || COALESCE(teacher_name, 'your teacher');
  href := '/student/homework?homework=' || NEW.id::TEXT;

  INSERT INTO notification_events (
    user_id,
    notification_type,
    event_key,
    source_type,
    source_id,
    role,
    priority,
    payload
  ) VALUES (
    student_user_id,
    'homework_assigned',
    'homework:' || NEW.id::TEXT || ':assigned:' || NEW.created_at::TEXT,
    'homework',
    NEW.id,
    'student',
    2,
    jsonb_build_object(
      'href', href,
      'title', title,
      'message', message,
      'email_subject', title,
      'email_body', message,
      'homework_id', NEW.id,
      'due_date', NEW.due_date
    )
  )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_homework_assigned ON homework;
CREATE TRIGGER trigger_homework_assigned
  AFTER INSERT ON homework
  FOR EACH ROW EXECUTE FUNCTION notify_homework_assigned();

-- Homework: submitted by student
CREATE OR REPLACE FUNCTION notify_homework_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  teacher_id UUID;
  student_name TEXT;
  homework_title TEXT;
  title TEXT;
  message TEXT;
  href TEXT;
BEGIN
  SELECT h.teacher_id, h.title, s.full_name
  INTO teacher_id, homework_title, student_name
  FROM homework h
  JOIN students s ON s.id = h.student_id
  WHERE h.id = NEW.homework_id;

  IF teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  title := 'Homework submitted';
  message := COALESCE(student_name, 'A student') || ' submitted ' || COALESCE(homework_title, 'homework');
  href := '/teacher/homework?homework=' || NEW.homework_id::TEXT;

  INSERT INTO notification_events (
    user_id,
    notification_type,
    event_key,
    source_type,
    source_id,
    role,
    priority,
    payload
  ) VALUES (
    teacher_id,
    'homework_submitted',
    'homework_submission:' || NEW.id::TEXT || ':submitted:'
      || COALESCE(NEW.submitted_at, NOW())::TEXT,
    'homework',
    NEW.homework_id,
    'teacher',
    1,
    jsonb_build_object(
      'href', href,
      'title', title,
      'message', message,
      'email_subject', title,
      'email_body', message,
      'homework_id', NEW.homework_id,
      'submission_id', NEW.id
    )
  )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_homework_submitted ON homework_submissions;
CREATE TRIGGER trigger_homework_submitted
  AFTER INSERT ON homework_submissions
  FOR EACH ROW EXECUTE FUNCTION notify_homework_submitted();

-- Credits: threshold reached (per student row)
CREATE OR REPLACE FUNCTION notify_credit_threshold_reached()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  teacher_id UUID := NEW.teacher_id;
  student_user_id UUID := NEW.user_id;
  student_name TEXT;
  teacher_name TEXT;
  thresholds INTEGER[];
  threshold_value INTEGER;
  title TEXT;
  message TEXT;
  href TEXT;
BEGIN
  IF NEW.credits IS NULL OR OLD.credits IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.credits >= OLD.credits THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO student_name
  FROM students
  WHERE id = NEW.id;

  SELECT full_name INTO teacher_name
  FROM profiles
  WHERE id = teacher_id;

  -- Teacher recipient
  IF teacher_id IS NOT NULL THEN
    SELECT COALESCE(np.credit_thresholds, nc.default_credit_thresholds)
    INTO thresholds
    FROM notification_type_catalog nc
    LEFT JOIN notification_preferences np
      ON np.user_id = teacher_id
     AND np.notification_type = 'credit_threshold_reached'
    WHERE nc.notification_type = 'credit_threshold_reached';

    FOREACH threshold_value IN ARRAY COALESCE(thresholds, ARRAY[]::INTEGER[]) LOOP
      IF OLD.credits > threshold_value AND NEW.credits <= threshold_value THEN
        title := 'Credits running low';
        message := COALESCE(student_name, 'A student')
          || ' has ' || NEW.credits::TEXT || ' credits remaining';
        href := '/teacher/students?student=' || NEW.id::TEXT;

        INSERT INTO notification_events (
          user_id,
          notification_type,
          event_key,
          source_type,
          source_id,
          role,
          priority,
          payload
        ) VALUES (
          teacher_id,
          'credit_threshold_reached',
          'student:' || NEW.id::TEXT || ':credit_threshold:' || threshold_value::TEXT
            || ':crossed:' || OLD.credits::TEXT || '->' || NEW.credits::TEXT
            || ':' || COALESCE(NEW.updated_at, NOW())::TEXT,
          'credits',
          NEW.id,
          'teacher',
          CASE WHEN threshold_value <= 1 THEN 3 ELSE 2 END,
          jsonb_build_object(
            'href', href,
            'title', title,
            'message', message,
            'email_subject', title,
            'email_body', message,
            'threshold', threshold_value,
            'credits_remaining', NEW.credits,
            'student_id', NEW.id,
            'teacher_id', teacher_id
          )
        )
        ON CONFLICT (user_id, event_key) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Student recipient (if linked)
  IF student_user_id IS NOT NULL THEN
    SELECT COALESCE(np.credit_thresholds, nc.default_credit_thresholds)
    INTO thresholds
    FROM notification_type_catalog nc
    LEFT JOIN notification_preferences np
      ON np.user_id = student_user_id
     AND np.notification_type = 'credit_threshold_reached'
    WHERE nc.notification_type = 'credit_threshold_reached';

    FOREACH threshold_value IN ARRAY COALESCE(thresholds, ARRAY[]::INTEGER[]) LOOP
      IF OLD.credits > threshold_value AND NEW.credits <= threshold_value THEN
        title := 'Credits running low';
        message := 'You have ' || NEW.credits::TEXT || ' credits remaining'
          || CASE WHEN teacher_name IS NOT NULL THEN ' with ' || teacher_name ELSE '' END;
        href := '/student/finance?teacher=' || teacher_id::TEXT;

        INSERT INTO notification_events (
          user_id,
          notification_type,
          event_key,
          source_type,
          source_id,
          role,
          priority,
          payload
        ) VALUES (
          student_user_id,
          'credit_threshold_reached',
          'student:' || NEW.id::TEXT || ':credit_threshold:' || threshold_value::TEXT
            || ':crossed:' || OLD.credits::TEXT || '->' || NEW.credits::TEXT
            || ':' || COALESCE(NEW.updated_at, NOW())::TEXT,
          'credits',
          NEW.id,
          'student',
          CASE WHEN threshold_value <= 1 THEN 3 ELSE 2 END,
          jsonb_build_object(
            'href', href,
            'title', title,
            'message', message,
            'email_subject', title,
            'email_body', message,
            'threshold', threshold_value,
            'credits_remaining', NEW.credits,
            'student_id', NEW.id,
            'teacher_id', teacher_id
          )
        )
        ON CONFLICT (user_id, event_key) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_credit_threshold_reached ON students;
CREATE TRIGGER trigger_credit_threshold_reached
  AFTER UPDATE OF credits ON students
  FOR EACH ROW EXECUTE FUNCTION notify_credit_threshold_reached();
