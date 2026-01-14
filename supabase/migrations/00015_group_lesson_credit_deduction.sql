-- ===========================================================
-- 00015_group_lesson_credit_deduction.sql
-- Deduct credits for ALL lesson participants (group lessons)
-- ===========================================================

-- When a lesson is completed, deduct credits from every student participating
-- in the lesson (as recorded in public.lesson_students), not only lessons.student_id.
CREATE OR REPLACE FUNCTION deduct_lesson_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    WITH updated AS (
      UPDATE public.students s
      SET credits = s.credits - NEW.credits_used
      WHERE s.id IN (
        SELECT ls.student_id
        FROM public.lesson_students ls
        WHERE ls.lesson_id = NEW.id
      )
      RETURNING s.id AS student_id, s.credits AS balance_after
    )
    INSERT INTO public.credit_ledger (student_id, teacher_id, amount, balance_after, description, lesson_id)
    SELECT
      u.student_id,
      NEW.teacher_id,
      -NEW.credits_used,
      u.balance_after,
      'Lesson completed: ' || NEW.title,
      NEW.id
    FROM updated u;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

