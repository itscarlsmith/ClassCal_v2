-- ===========================================================
-- 1. HOMEWORK STATUS ENUM: ENSURE ALL STATES EXIST
-- ===========================================================

alter type public.homework_status add value if not exists 'submitted';
alter type public.homework_status add value if not exists 'completed';
alter type public.homework_status add value if not exists 'cancelled';
alter type public.homework_status add value if not exists 'needs_revision';

-- ===========================================================
-- 2. MATERIALS: ADD CONTENT + INDEXES
-- ===========================================================

alter table public.materials
  add column if not exists content jsonb null;

create index if not exists idx_materials_teacher
  on public.materials (teacher_id);

create index if not exists idx_materials_tags_gin
  on public.materials using gin (tags);

-- ===========================================================
-- 3. HOMEWORK_MATERIALS TABLE (NEW)
-- ===========================================================

create table if not exists public.homework_materials (
  id uuid not null default extensions.uuid_generate_v4 (),
  homework_id uuid not null,
  material_id uuid not null,
  created_at timestamptz not null default now(),

  constraint homework_materials_pkey primary key (id),
  constraint homework_materials_homework_id_material_id_key
    unique (homework_id, material_id),

  constraint homework_materials_homework_id_fkey
    foreign key (homework_id) references public.homework (id)
      on delete cascade,
  constraint homework_materials_material_id_fkey
    foreign key (material_id) references public.materials (id)
      on delete cascade
);

create index if not exists idx_homework_materials_homework
  on public.homework_materials (homework_id);

create index if not exists idx_homework_materials_material
  on public.homework_materials (material_id);

-- ===========================================================
-- 4. HOMEWORK_SUBMISSIONS: MULTIPLE ATTEMPTS SUPPORT
-- ===========================================================

alter table public.homework_submissions
  add column if not exists attempt integer not null default 1,
  add column if not exists is_latest boolean not null default true;

create index if not exists idx_homework_submissions_homework
  on public.homework_submissions (homework_id);

create index if not exists idx_homework_submissions_homework_latest
  on public.homework_submissions (homework_id, is_latest)
  where is_latest = true;

-- ===========================================================
-- 5. ENSURE RLS ENABLED
-- ===========================================================

alter table public.materials            enable row level security;
alter table public.lesson_materials     enable row level security;
alter table public.homework             enable row level security;
alter table public.homework_materials   enable row level security;
alter table public.homework_submissions enable row level security;

-- ===========================================================
-- 6. RLS POLICIES: MATERIALS
--    - Teachers CRUD their own materials
--    - Students can view materials attached to their lessons / homework
-- ===========================================================

-- Existing policies from UI:
--   "Teachers can delete materials" (DELETE)
--   "Teachers can insert materials" (INSERT)
--   "Teachers can update materials" (UPDATE)
--   "Teachers can view own materials" (SELECT)

drop policy if exists "Teachers can delete materials" on public.materials;
drop policy if exists "Teachers can insert materials" on public.materials;
drop policy if exists "Teachers can update materials" on public.materials;
drop policy if exists "Teachers can view own materials" on public.materials;

-- Teachers: full CRUD on their own materials
create policy "Teachers can manage materials"
on public.materials
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

-- Students: can read materials that are attached to their lessons or homework
create policy "Students can view attached materials"
on public.materials
for select
using (
  -- via lessons
  exists (
    select 1
    from public.lesson_materials lm
    join public.lessons l
      on l.id = lm.lesson_id
    join public.students s
      on s.id = l.student_id
    where lm.material_id = public.materials.id
      and s.user_id = auth.uid()
  )
  -- via homework
  or exists (
    select 1
    from public.homework_materials hm
    join public.homework h
      on h.id = hm.homework_id
    join public.students s2
      on s2.id = h.student_id
    where hm.material_id = public.materials.id
      and s2.user_id = auth.uid()
  )
);

-- ===========================================================
-- 7. RLS POLICIES: LESSON_MATERIALS
--    - Teachers manage links on their own lessons
--    - Teachers + the linked student can view lesson/material links
-- ===========================================================

-- Existing policies from UI:
--   "Teachers can manage lesson materials" (ALL)
--   "View lesson materials" (SELECT)

drop policy if exists "Teachers can manage lesson materials" on public.lesson_materials;
drop policy if exists "View lesson materials" on public.lesson_materials;

-- Teachers: manage lesson_material rows for their lessons
create policy "Teachers can manage lesson materials"
on public.lesson_materials
for all
using (
  exists (
    select 1
    from public.lessons l
    where l.id = public.lesson_materials.lesson_id
      and l.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lessons l
    where l.id = public.lesson_materials.lesson_id
      and l.teacher_id = auth.uid()
  )
);

-- Teacher or student of the lesson can view the links
create policy "Users can view lesson materials"
on public.lesson_materials
for select
using (
  exists (
    select 1
    from public.lessons l
    where l.id = public.lesson_materials.lesson_id
      and (
        l.teacher_id = auth.uid()
        or exists (
          select 1
          from public.students s
          where s.id = l.student_id
            and s.user_id = auth.uid()
        )
      )
  )
);

-- ===========================================================
-- 8. RLS POLICIES: HOMEWORK
--    - Teachers CRUD their own homework
--    - Teachers + the assigned student can view the homework
-- ===========================================================

-- Existing policies from UI:
--   "Teachers can delete homework" (DELETE)
--   "Teachers can insert homework" (INSERT)
--   "Teachers can update homework" (UPDATE)
--   "View homework" (SELECT)

drop policy if exists "Teachers can delete homework" on public.homework;
drop policy if exists "Teachers can insert homework" on public.homework;
drop policy if exists "Teachers can update homework" on public.homework;
drop policy if exists "View homework" on public.homework;

-- Teachers: full CRUD on their own homework rows
create policy "Teachers can manage homework"
on public.homework
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

-- Teacher or student assigned to the homework can view it
create policy "Users can view homework"
on public.homework
for select
using (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.students s
    where s.id = public.homework.student_id
      and s.user_id = auth.uid()
  )
);

-- ===========================================================
-- 9. RLS POLICIES: HOMEWORK_MATERIALS (NEW TABLE)
--    - Teachers manage attachments for their homework
--    - Teachers + assigned student can view attachments
-- ===========================================================

drop policy if exists "Teachers can manage homework materials" on public.homework_materials;
drop policy if exists "Users can view homework materials"   on public.homework_materials;

-- Teachers: manage homework/material links
create policy "Teachers can manage homework materials"
on public.homework_materials
for all
using (
  exists (
    select 1
    from public.homework h
    where h.id = public.homework_materials.homework_id
      and h.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.homework h
    where h.id = public.homework_materials.homework_id
      and h.teacher_id = auth.uid()
  )
);

-- Teacher or student assigned to the homework can view the links
create policy "Users can view homework materials"
on public.homework_materials
for select
using (
  exists (
    select 1
    from public.homework h
    where h.id = public.homework_materials.homework_id
      and (
        h.teacher_id = auth.uid()
        or exists (
          select 1
          from public.students s
          where s.id = h.student_id
            and s.user_id = auth.uid()
        )
      )
  )
);

-- ===========================================================
-- 10. RLS POLICIES: HOMEWORK_SUBMISSIONS
--     - Students manage their own submissions
--     - Teachers can read & update submissions for their homework
-- ===========================================================

-- Existing policies from UI:
--   "Students can submit" (INSERT)
--   "Update submissions" (UPDATE)
--   "View submissions" (SELECT)

drop policy if exists "Students can submit"       on public.homework_submissions;
drop policy if exists "Update submissions"        on public.homework_submissions;
drop policy if exists "View submissions"          on public.homework_submissions;
drop policy if exists "Students can manage own submissions" on public.homework_submissions;
drop policy if exists "Teachers can view submissions"       on public.homework_submissions;
drop policy if exists "Teachers can update submissions"     on public.homework_submissions;

-- Students: full control over their own submissions
create policy "Students can manage own submissions"
on public.homework_submissions
for all
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
);

-- Teachers: read submissions for homework they own
create policy "Teachers can view submissions"
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

-- Teachers: update submissions (feedback / grade) for homework they own
create policy "Teachers can update submissions"
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

------------------------------

-- Context
-- The rest of this file duplicates the SQL you applied directly via Supabase UI.
