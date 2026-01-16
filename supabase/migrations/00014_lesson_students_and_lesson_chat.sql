-- ===========================================================
-- 00014_lesson_students_and_lesson_chat.sql
-- Adds lesson_students join table for multi-student lessons,
-- extends the existing messages system to support lesson-scoped
-- conversations, and tightens RLS policies accordingly.
-- ===========================================================

-- ----------------------------
-- Lesson participants mapping
-- ----------------------------
create table if not exists public.lesson_students (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint lesson_students_pkey primary key (lesson_id, student_id)
);

create index if not exists idx_lesson_students_lesson
  on public.lesson_students (lesson_id);

create index if not exists idx_lesson_students_student
  on public.lesson_students (student_id);

insert into public.lesson_students (lesson_id, student_id)
select id, student_id
from public.lessons
where student_id is not null
on conflict (lesson_id, student_id) do nothing;

alter table public.lesson_students enable row level security;

drop policy if exists "Teachers view lesson students" on public.lesson_students;
drop policy if exists "Teachers manage lesson students" on public.lesson_students;
drop policy if exists "Students view their lesson students" on public.lesson_students;
drop policy if exists "Students view their lesson participation" on public.lesson_students;

-- NOTE: Avoid RLS recursion:
-- - public.lessons SELECT policy reads from public.lesson_students
-- - if public.lesson_students SELECT policy reads from public.lessons, Postgres detects
--   infinite recursion ("infinite recursion detected in policy for relation \"lessons\"")
-- This unified policy relies only on public.students, which breaks the cycle.
create policy "Lesson students visible to teacher or student"
on public.lesson_students
for select
using (
  exists (
    select 1
    from public.students s
    where s.id = public.lesson_students.student_id
      and (s.teacher_id = auth.uid() or s.user_id = auth.uid())
  )
);

create policy "Teachers manage lesson students"
on public.lesson_students
for insert
with check (
  exists (
    select 1
    from public.lessons l
    join public.students s
      on s.id = public.lesson_students.student_id
    where l.id = public.lesson_students.lesson_id
      and l.teacher_id = auth.uid()
      and s.teacher_id = auth.uid()
  )
);

create policy "Teachers remove lesson students"
on public.lesson_students
for delete
using (
  exists (
    select 1
    from public.lessons l
    where l.id = public.lesson_students.lesson_id
      and l.teacher_id = auth.uid()
  )
);

-- (intentionally removed; covered by "Lesson students visible to teacher or student")

-- ----------------------------------------------------
-- Lessons visible to all authorized participants/users
-- ----------------------------------------------------
drop policy if exists "Teachers can view their lessons" on public.lessons;

create policy "Lessons visible to participants"
on public.lessons
for select
using (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.students s
    where s.id = public.lessons.student_id
      and s.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.lesson_students ls
    join public.students s2
      on s2.id = ls.student_id
    where ls.lesson_id = public.lessons.id
      and s2.user_id = auth.uid()
  )
);

