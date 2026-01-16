-- ===========================================================
-- 00007_homework_schema_hardening.sql
-- Adds audit columns and constraints required for the
-- authoritative homework workflow.
-- ===========================================================

-- ----------------------------
-- Homework table additions
-- ----------------------------
alter table public.homework
  add column if not exists completed_at timestamptz,
  add column if not exists first_submitted_at timestamptz;

create index if not exists idx_homework_status_due_date
  on public.homework (status, due_date);

-- ----------------------------
-- Homework submissions additions
-- ----------------------------
alter table public.homework_submissions
  add column if not exists revision_requested_at timestamptz,
  add column if not exists revision_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references public.profiles(id) on delete set null,
  add column if not exists file_paths text[] not null default '{}'::text[],
  add column if not exists original_filenames text[] not null default '{}'::text[];

alter table public.homework_submissions
  drop constraint if exists homework_submissions_attempt_positive;

alter table public.homework_submissions
  add constraint homework_submissions_attempt_positive
    check (attempt > 0);

-- Replace the non-unique latest index with a unique variant.
drop index if exists idx_homework_submissions_homework_latest;

create unique index if not exists idx_homework_submissions_homework_latest
  on public.homework_submissions (homework_id)
  where is_latest;

create index if not exists idx_homework_submissions_homework_attempt_desc
  on public.homework_submissions (homework_id, attempt desc);


