-- ===========================================================
-- 00018_credit_ledger_reservation_system.sql
-- Transaction-based credit reservation system
-- ===========================================================

-- 1) Add ledger type column and backfill legacy rows
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS type TEXT;

UPDATE public.credit_ledger
SET type = CASE
  WHEN amount > 0 THEN 'manual_add'
  WHEN amount < 0 THEN 'manual_deduct'
  ELSE 'consume'
END
WHERE type IS NULL;

ALTER TABLE public.credit_ledger
  ALTER COLUMN type SET NOT NULL;

-- 2) Enforce ledger vocabulary and amount/lesson invariants
ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_type_check
  CHECK (type IN (
    'purchase',
    'manual_add',
    'reserve',
    'return',
    'consume',
    'manual_deduct',
    'opening_balance'
  ));

ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_amount_check
  CHECK (
    (type IN ('purchase', 'manual_add', 'opening_balance') AND amount > 0)
    OR (type = 'manual_deduct' AND amount < 0)
    OR (type = 'reserve' AND amount = -1)
    OR (type = 'return' AND amount = 1)
    OR (type = 'consume' AND amount = 0)
  );

ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_lesson_required_check
  CHECK (
    (type IN ('reserve', 'return', 'consume') AND lesson_id IS NOT NULL)
    OR (type NOT IN ('reserve', 'return', 'consume'))
  );

-- 3) Add indexes/uniqueness for reservation lifecycle
CREATE INDEX IF NOT EXISTS idx_credit_ledger_teacher_student_created
  ON public.credit_ledger (teacher_id, student_id, created_at);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_lesson
  ON public.credit_ledger (lesson_id);

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_reserve_unique
  ON public.credit_ledger (lesson_id)
  WHERE type = 'reserve';

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_closeout_unique
  ON public.credit_ledger (lesson_id)
  WHERE type IN ('return', 'consume');

-- 4) Centralize balance calculation + cache update
DROP TRIGGER IF EXISTS credit_ledger_before_insert ON public.credit_ledger;
DROP FUNCTION IF EXISTS public.credit_ledger_before_insert();

CREATE OR REPLACE FUNCTION public.credit_ledger_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
  lesson_exists BOOLEAN;
  payment_exists BOOLEAN;
BEGIN
  -- Serialize per teacher/student to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(NEW.teacher_id::text || ':' || NEW.student_id::text)::bigint);

  -- Ensure student belongs to teacher (teacher-scoped invariant)
  IF NOT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = NEW.student_id
      AND s.teacher_id = NEW.teacher_id
  ) THEN
    RAISE EXCEPTION 'credit_ledger_student_teacher_mismatch';
  END IF;

  -- Ensure lesson matches teacher/student when provided
  IF NEW.lesson_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.lessons l
      WHERE l.id = NEW.lesson_id
        AND l.teacher_id = NEW.teacher_id
        AND l.student_id = NEW.student_id
    ) INTO lesson_exists;

    IF NOT lesson_exists THEN
      RAISE EXCEPTION 'credit_ledger_lesson_mismatch';
    END IF;
  END IF;

  -- Ensure payment matches teacher/student when provided
  IF NEW.payment_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.payments p
      WHERE p.id = NEW.payment_id
        AND p.teacher_id = NEW.teacher_id
        AND p.student_id = NEW.student_id
    ) INTO payment_exists;

    IF NOT payment_exists THEN
      RAISE EXCEPTION 'credit_ledger_payment_mismatch';
    END IF;
  END IF;

  -- Enforce lifecycle: return/consume require a prior reserve
  IF NEW.type IN ('return', 'consume') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.credit_ledger cl
      WHERE cl.lesson_id = NEW.lesson_id
        AND cl.type = 'reserve'
    ) THEN
      RAISE EXCEPTION 'credit_ledger_missing_reserve';
    END IF;
  END IF;

  -- Compute available balance from ledger sum
  SELECT COALESCE(SUM(amount), 0)
  INTO current_balance
  FROM public.credit_ledger
  WHERE teacher_id = NEW.teacher_id
    AND student_id = NEW.student_id;

  new_balance := current_balance + NEW.amount;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'credit_balance_negative';
  END IF;

  NEW.balance_after := new_balance;

  UPDATE public.students
  SET credits = new_balance
  WHERE id = NEW.student_id
    AND teacher_id = NEW.teacher_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER credit_ledger_before_insert
BEFORE INSERT ON public.credit_ledger
FOR EACH ROW
EXECUTE FUNCTION public.credit_ledger_before_insert();

-- 5) Cutover initialization with opening_balance
DO $$
DECLARE
  bad_ids TEXT;
BEGIN
  WITH balances AS (
    SELECT
      s.id AS student_id,
      s.teacher_id AS teacher_id,
      s.credits AS cached_credits,
      COALESCE(SUM(cl.amount), 0) AS ledger_sum,
      s.credits - COALESCE(SUM(cl.amount), 0) AS opening_needed
    FROM public.students s
    LEFT JOIN public.credit_ledger cl
      ON cl.student_id = s.id
     AND cl.teacher_id = s.teacher_id
    GROUP BY s.id, s.teacher_id, s.credits
  ),
  negatives AS (
    SELECT student_id
    FROM balances
    WHERE opening_needed < 0
    ORDER BY opening_needed ASC
    LIMIT 10
  )
  SELECT string_agg(student_id::text, ', ')
  INTO bad_ids
  FROM negatives;

  IF bad_ids IS NOT NULL THEN
    RAISE EXCEPTION 'opening_balance_negative for students: %', bad_ids;
  END IF;
END $$;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      s.id AS student_id,
      s.teacher_id AS teacher_id,
      s.credits - COALESCE(SUM(cl.amount), 0) AS opening_needed
    FROM public.students s
    LEFT JOIN public.credit_ledger cl
      ON cl.student_id = s.id
     AND cl.teacher_id = s.teacher_id
    GROUP BY s.id, s.teacher_id, s.credits
    HAVING s.credits - COALESCE(SUM(cl.amount), 0) > 0
  LOOP
    INSERT INTO public.credit_ledger (student_id, teacher_id, amount, description, type)
    VALUES (
      rec.student_id,
      rec.teacher_id,
      rec.opening_needed,
      'Opening balance (cutover)',
      'opening_balance'
    );
  END LOOP;
END $$;

-- 6) Backfill reserves for existing future lessons only
DO $$
DECLARE
  bad_pairs TEXT;
BEGIN
  WITH future_lessons AS (
    SELECT
      l.teacher_id,
      l.student_id,
      COUNT(*) AS reserve_needed
    FROM public.lessons l
    WHERE l.status IN ('pending', 'confirmed')
      AND l.start_time > NOW()
      AND NOT EXISTS (
        SELECT 1
        FROM public.credit_ledger cl
        WHERE cl.lesson_id = l.id
          AND cl.type = 'reserve'
      )
    GROUP BY l.teacher_id, l.student_id
  ),
  available AS (
    SELECT
      teacher_id,
      student_id,
      COALESCE(SUM(amount), 0) AS available_credits
    FROM public.credit_ledger
    GROUP BY teacher_id, student_id
  ),
  insufficient AS (
    SELECT
      f.teacher_id,
      f.student_id,
      f.reserve_needed,
      COALESCE(a.available_credits, 0) AS available_credits
    FROM future_lessons f
    LEFT JOIN available a
      ON a.teacher_id = f.teacher_id
     AND a.student_id = f.student_id
    WHERE COALESCE(a.available_credits, 0) - f.reserve_needed < 0
    ORDER BY f.reserve_needed DESC
    LIMIT 10
  )
  SELECT string_agg(f.teacher_id::text || '/' || f.student_id::text, ', ')
  INTO bad_pairs
  FROM insufficient f;

  IF bad_pairs IS NOT NULL THEN
    RAISE EXCEPTION 'insufficient_credits_for_existing_future_lessons: %', bad_pairs;
  END IF;
END $$;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      l.id AS lesson_id,
      l.student_id AS student_id,
      l.teacher_id AS teacher_id,
      l.title AS title
    FROM public.lessons l
    WHERE l.status IN ('pending', 'confirmed')
      AND l.start_time > NOW()
      AND NOT EXISTS (
        SELECT 1
        FROM public.credit_ledger cl
        WHERE cl.lesson_id = l.id
          AND cl.type = 'reserve'
      )
  LOOP
    INSERT INTO public.credit_ledger (student_id, teacher_id, amount, description, lesson_id, type)
    VALUES (
      rec.student_id,
      rec.teacher_id,
      -1,
      'Lesson reserved (cutover): ' || rec.title,
      rec.lesson_id,
      'reserve'
    );
  END LOOP;
END $$;

-- 7) Replace legacy completion deduction with reservation/closeout triggers
DROP TRIGGER IF EXISTS on_lesson_completed ON public.lessons;
DROP FUNCTION IF EXISTS public.deduct_lesson_credit();

DROP TRIGGER IF EXISTS on_lesson_reserved ON public.lessons;
DROP FUNCTION IF EXISTS public.reserve_lesson_credit();

CREATE OR REPLACE FUNCTION public.reserve_lesson_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pending', 'confirmed') THEN
    INSERT INTO public.credit_ledger (student_id, teacher_id, amount, description, lesson_id, type)
    VALUES (
      NEW.student_id,
      NEW.teacher_id,
      -1,
      'Lesson reserved: ' || NEW.title,
      NEW.id,
      'reserve'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_lesson_reserved
AFTER INSERT ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.reserve_lesson_credit();

DROP TRIGGER IF EXISTS on_lesson_status_change ON public.lessons;
DROP FUNCTION IF EXISTS public.handle_lesson_credit_transition();

CREATE OR REPLACE FUNCTION public.handle_lesson_credit_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  policy_hours INTEGER;
  policy_cutoff TIMESTAMPTZ;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Completion consumes the reservation (amount 0)
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.credit_ledger (student_id, teacher_id, amount, description, lesson_id, type)
    VALUES (
      NEW.student_id,
      NEW.teacher_id,
      0,
      'Lesson completed: ' || NEW.title,
      NEW.id,
      'consume'
    );
    RETURN NEW;
  END IF;

  -- Cancellation returns or consumes based on policy window
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF OLD.status = 'pending' THEN
      INSERT INTO public.credit_ledger (student_id, teacher_id, amount, description, lesson_id, type)
      VALUES (
        NEW.student_id,
        NEW.teacher_id,
        1,
        'Lesson cancelled (pending): ' || NEW.title,
        NEW.id,
        'return'
      );
      RETURN NEW;
    END IF;

    IF OLD.status = 'confirmed' THEN
      SELECT cancellation_policy_hours
      INTO policy_hours
      FROM public.teacher_settings
      WHERE teacher_id = NEW.teacher_id;

      policy_hours := COALESCE(policy_hours, 24);
      policy_cutoff := NEW.start_time - make_interval(hours => policy_hours);

      IF NOW() >= policy_cutoff THEN
        INSERT INTO public.credit_ledger (student_id, teacher_id, amount, description, lesson_id, type)
        VALUES (
          NEW.student_id,
          NEW.teacher_id,
          0,
          'Lesson cancelled (inside policy): ' || NEW.title,
          NEW.id,
          'consume'
        );
      ELSE
        INSERT INTO public.credit_ledger (student_id, teacher_id, amount, description, lesson_id, type)
        VALUES (
          NEW.student_id,
          NEW.teacher_id,
          1,
          'Lesson cancelled (outside policy): ' || NEW.title,
          NEW.id,
          'return'
        );
      END IF;

      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_lesson_status_change
AFTER UPDATE ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.handle_lesson_credit_transition();
