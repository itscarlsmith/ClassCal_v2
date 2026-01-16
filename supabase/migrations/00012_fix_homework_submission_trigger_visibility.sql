-- ===========================================================
-- 00012_fix_homework_submission_trigger_visibility.sql
--
-- Fix: student submission inserts intermittently failing with:
--   P0001: "Homework <uuid> does not exist"
--
-- Root cause:
-- - The BEFORE INSERT trigger on homework_submissions reads from public.homework.
-- - Under RLS, that lookup can return 0 rows depending on execution context.
--
-- Fix approach:
-- - Make the trigger function SECURITY DEFINER so internal validation is not
--   dependent on caller RLS visibility.
-- - Add an explicit "student owns student_id" check inside the trigger so we
--   still enforce ownership even if RLS ordering changes.
-- ===========================================================

create or replace function public.before_insert_homework_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hw_student uuid;
  hw_status public.homework_status;
begin
  -- Hard guarantee: the authenticated user must own the student_id they claim.
  if not exists (
    select 1
      from public.students s
     where s.id = new.student_id
       and s.user_id = auth.uid()
  ) then
    raise exception 'Student % is not owned by current user', new.student_id;
  end if;

  -- Load homework (bypass caller RLS via SECURITY DEFINER).
  select h.student_id, h.status
    into hw_student, hw_status
    from public.homework h
   where h.id = new.homework_id;

  if not found then
    raise exception 'Homework % does not exist', new.homework_id;
  end if;

  if hw_student <> new.student_id then
    raise exception 'Student % is not assigned to homework %', new.student_id, new.homework_id;
  end if;

  if hw_status in ('completed', 'reviewed', 'cancelled') then
    raise exception 'Homework % is % and no longer accepts submissions', new.homework_id, hw_status;
  end if;

  -- Ensure attempt numbering / latest demotion is concurrency-safe.
  perform pg_advisory_xact_lock(hashtext(new.homework_id::text)::bigint);

  select coalesce(max(attempt), 0) + 1
    into new.attempt
    from public.homework_submissions
   where homework_id = new.homework_id;

  new.is_latest := true;
  new.submitted_at := coalesce(new.submitted_at, now());

  perform set_config('classcal.hw_submission_internal', 'true', true);
  begin
    update public.homework_submissions
       set is_latest = false
     where homework_id = new.homework_id
       and is_latest;
  exception
    when others then
      perform set_config('classcal.hw_submission_internal', 'false', true);
      raise;
  end;
  perform set_config('classcal.hw_submission_internal', 'false', true);

  -- Students cannot bootstrap teacher-managed fields.
  new.feedback := null;
  new.grade := null;
  new.revision_requested_at := null;
  new.revision_requested_by := null;
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.accepted_at := null;
  new.accepted_by := null;

  new.file_paths := coalesce(new.file_paths, '{}'::text[]);
  new.original_filenames := coalesce(new.original_filenames, '{}'::text[]);

  return new;
end;
$$;



