-- ===========================================================
-- 00017_remove_lesson_students.sql
-- Remove lesson_students artifacts and restore single-student model
-- ===========================================================

-- 1) Drop trigger/function that enforced lesson_students rows
DROP TRIGGER IF EXISTS on_lesson_students_primary ON public.lessons;
DROP FUNCTION IF EXISTS public.ensure_lesson_students_primary();

-- 2) Restore single-student lessons SELECT policy
DROP POLICY IF EXISTS "Lessons visible to participants" ON public.lessons;
DROP POLICY IF EXISTS "Teachers can view their lessons" ON public.lessons;

CREATE POLICY "Teachers can view their lessons"
ON public.lessons
FOR SELECT
USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = public.lessons.student_id
      AND s.user_id = auth.uid()
  )
);

-- 3) Restore single-student credit deduction function
CREATE OR REPLACE FUNCTION deduct_lesson_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update student credits
    UPDATE students
    SET credits = credits - NEW.credits_used
    WHERE id = NEW.student_id;

    -- Record in ledger
    INSERT INTO credit_ledger (student_id, teacher_id, amount, balance_after, description, lesson_id)
    SELECT
      NEW.student_id,
      NEW.teacher_id,
      -NEW.credits_used,
      s.credits - NEW.credits_used,
      'Lesson completed: ' || NEW.title,
      NEW.id
    FROM students s WHERE s.id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- 4) Drop lesson_students join table
DROP POLICY IF EXISTS "Lesson students visible to teacher or student" ON public.lesson_students;
DROP POLICY IF EXISTS "Teachers manage lesson students" ON public.lesson_students;
DROP POLICY IF EXISTS "Teachers remove lesson students" ON public.lesson_students;
DROP TABLE IF EXISTS public.lesson_students;
