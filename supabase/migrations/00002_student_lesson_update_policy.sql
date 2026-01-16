-- Allow students to update the status of their own lessons
-- This complements the existing teacher-only update policy on lessons.

CREATE POLICY "Students can update their own lessons"
ON lessons
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM students
    WHERE students.id = lessons.student_id
      AND students.user_id = auth.uid()
  )
);


