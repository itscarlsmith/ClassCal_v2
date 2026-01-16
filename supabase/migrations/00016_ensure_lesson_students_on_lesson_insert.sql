-- ===========================================================
-- 00016_ensure_lesson_students_on_lesson_insert.sql
-- Always create lesson_students row for primary student
-- ===========================================================

-- Ensures every lesson has at least one participant row in lesson_students
-- (the primary lessons.student_id). This supported lesson_students-based logic.
-- credit deduction based on lesson_students.

CREATE OR REPLACE FUNCTION ensure_lesson_students_primary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.lesson_students (lesson_id, student_id)
  VALUES (NEW.id, NEW.student_id)
  ON CONFLICT (lesson_id, student_id) DO NOTHING;

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lesson_students_primary ON public.lessons;

CREATE TRIGGER on_lesson_students_primary
  AFTER INSERT ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION ensure_lesson_students_primary();

