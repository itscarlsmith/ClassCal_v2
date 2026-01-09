-- ===========================================================
-- 00010_homework_submissions_rls.sql
-- Hardens RLS for homework submissions so students and teachers
-- only access permitted rows and roles.
-- ===========================================================

-- Drop legacy broad policies
drop policy if exists "Students can submit" on public.homework_submissions;
drop policy if exists "Update submissions" on public.homework_submissions;
drop policy if exists "View submissions" on public.homework_submissions;
drop policy if exists "Students can manage own submissions" on public.homework_submissions;
drop policy if exists "Teachers can view submissions" on public.homework_submissions;
drop policy if exists "Teachers can update submissions" on public.homework_submissions;

-- Students: SELECT only their submissions
create policy "Students read own submissions"
on public.homework_submissions
for select
using (
  exists (
    select 1
      from public.students s
     where s.id = public.homework_submissions.student_id
       and s.user_id = auth.uid()
  )
);

-- Students: INSERT submissions for homework assigned to them
create policy "Students submit homework"
on public.homework_submissions
for insert
with check (
  exists (
    select 1
      from public.students s
     where s.id = public.homework_submissions.student_id
       and s.user_id = auth.uid()
  )
  and exists (
    select 1
      from public.homework h
     where h.id = public.homework_submissions.homework_id
       and h.student_id = public.homework_submissions.student_id
  )
);

-- Students: UPDATE only their own submissions (for metadata)
create policy "Students update own submissions"
on public.homework_submissions
for update
using (
  exists (
    select 1
      from public.students s
     where s.id = public.homework_submissions.student_id
       and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.students s
     where s.id = public.homework_submissions.student_id
       and s.user_id = auth.uid()
  )
  and exists (
    select 1
      from public.homework h
     where h.id = public.homework_submissions.homework_id
       and h.student_id = public.homework_submissions.student_id
  )
);

-- Teachers: SELECT submissions for their homework
create policy "Teachers read homework submissions"
on public.homework_submissions
for select
using (
  exists (
    select 1
      from public.homework h
     where h.id = public.homework_submissions.homework_id
       and h.teacher_id = auth.uid()
  )
);

-- Teachers: UPDATE submissions they own (feedback, grading, etc.)
create policy "Teachers update homework submissions"
on public.homework_submissions
for update
using (
  exists (
    select 1
      from public.homework h
     where h.id = public.homework_submissions.homework_id
       and h.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.homework h
     where h.id = public.homework_submissions.homework_id
       and h.teacher_id = auth.uid()
  )
);

-- Teachers: optionally delete submissions they own (cleanup / admin)
create policy "Teachers delete homework submissions"
on public.homework_submissions
for delete
using (
  exists (
    select 1
      from public.homework h
     where h.id = public.homework_submissions.homework_id
       and h.teacher_id = auth.uid()
  )
);


