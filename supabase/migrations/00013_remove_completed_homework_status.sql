-- ===========================================================
-- 00013_remove_completed_homework_status.sql
--
-- Converts all homework currently marked as `completed` to
-- `reviewed`, removes the `completed` enum value, and updates
-- the state machine functions so “reviewed” is the terminal
-- state (teachers can only request revisions or mark reviewed).
-- ===========================================================

-- 1) Normalize existing data.
update public.homework
   set status = 'reviewed'
 where status = 'completed';

-- 2) Rebuild the enum without `completed`.
alter type public.homework_status rename to homework_status_old;

create type public.homework_status as enum (
  'assigned',
  'submitted',
  'needs_revision',
  'reviewed',
  'overdue',
  'cancelled'
);

alter table public.homework
  alter column status type public.homework_status
  using status::text::public.homework_status;

-- 3) Recreate state machine helpers/functions so they reference
--    the new enum definition and treat `reviewed` as terminal.

create or replace function public.internal_transition_homework(
  p_homework_id uuid,
  p_target_status public.homework_status,
  p_allowed_from public.homework_status[] default null,
  p_completed_at timestamptz default null,
  p_first_submitted timestamptz default null
) returns void
language plpgsql
security definer
as $$
declare
  current_status public.homework_status;
begin
  select status
    into current_status
    from public.homework
   where id = p_homework_id
   for update;

  if not found then
    raise exception 'Homework % not found', p_homework_id;
  end if;

  if p_allowed_from is not null
     and array_length(p_allowed_from, 1) > 0
     and not (current_status = any (p_allowed_from)) then
    if current_status = p_target_status then
      return;
    end if;
    raise exception 'Illegal homework status transition: % -> %', current_status, p_target_status;
  end if;

  if current_status = p_target_status
     and p_completed_at is null
     and p_first_submitted is null then
    return;
  end if;

  perform set_config('classcal.homework_status_bypass', 'true', true);
  begin
    update public.homework
       set status = p_target_status,
           completed_at = coalesce(p_completed_at, completed_at),
           first_submitted_at = coalesce(first_submitted_at, p_first_submitted)
     where id = p_homework_id;
  exception
    when others then
      perform set_config('classcal.homework_status_bypass', 'false', true);
      raise;
  end;
  perform set_config('classcal.homework_status_bypass', 'false', true);
end;
$$;

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
  if not exists (
    select 1
      from public.students s
     where s.id = new.student_id
       and s.user_id = auth.uid()
  ) then
    raise exception 'Student % is not owned by current user', new.student_id;
  end if;

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

  if hw_status in ('reviewed', 'cancelled') then
    raise exception 'Homework % is % and no longer accepts submissions', new.homework_id, hw_status;
  end if;

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

create or replace function public.after_insert_homework_submission()
returns trigger
language plpgsql
as $$
begin
  perform public.internal_transition_homework(
    new.homework_id,
    'submitted',
    array['assigned', 'overdue', 'needs_revision', 'submitted']::public.homework_status[],
    null,
    new.submitted_at
  );

  return new;
end;
$$;

create or replace function public.before_update_homework_submission()
returns trigger
language plpgsql
as $$
declare
  actor uuid := auth.uid();
  hw_teacher uuid;
  hw_status public.homework_status;
  is_teacher boolean := false;
  is_student boolean := false;
  internal_flag boolean := coalesce(current_setting('classcal.hw_submission_internal', true), 'false') = 'true';
begin
  perform pg_advisory_xact_lock(hashtext(new.homework_id::text)::bigint);

  if not internal_flag then
    if actor is null then
      raise exception 'Authentication is required to update submissions';
    end if;

    select h.teacher_id, h.status
      into hw_teacher, hw_status
      from public.homework h
     where h.id = new.homework_id;

    if not found then
      raise exception 'Homework % missing', new.homework_id;
    end if;

    is_teacher := hw_teacher = actor;
    is_student := exists (
      select 1
        from public.students s
       where s.id = new.student_id
         and s.user_id = actor
    );

    if not (is_teacher or is_student) then
      raise exception 'You are not allowed to modify this submission';
    end if;

    if hw_status = 'reviewed' then
      raise exception 'Reviewed homework is immutable';
    end if;
  end if;

  if new.homework_id <> old.homework_id
     or new.student_id <> old.student_id
     or new.attempt <> old.attempt then
    raise exception 'Submission identity fields cannot change';
  end if;

  if new.submitted_at <> old.submitted_at and not internal_flag then
    raise exception 'submitted_at is immutable';
  end if;

  if new.is_latest <> old.is_latest and not internal_flag then
    raise exception 'Only the system may toggle latest submissions';
  end if;

  if not internal_flag then
    if new.revision_requested_at is distinct from old.revision_requested_at then
      if old.revision_requested_at is not null then
        raise exception 'Revision requests cannot be changed once issued';
      end if;
      if new.revision_requested_at is null then
        raise exception 'Revision request timestamps cannot be cleared';
      end if;
    end if;

    if new.reviewed_at is distinct from old.reviewed_at then
      if old.reviewed_at is not null then
        raise exception 'Review timestamps cannot be changed once recorded';
      end if;
      if new.reviewed_at is null then
        raise exception 'Review timestamps cannot be cleared';
      end if;
    end if;

    if new.accepted_at is distinct from old.accepted_at then
      raise exception 'Homework acceptance is deprecated; use review.';
    end if;
  end if;

  if not internal_flag and is_student and not is_teacher then
    if new.feedback is distinct from old.feedback
       or new.grade is distinct from old.grade
       or new.revision_requested_at is distinct from old.revision_requested_at
       or new.reviewed_at is distinct from old.reviewed_at
       or new.accepted_at is distinct from old.accepted_at
       or new.revision_requested_by is distinct from old.revision_requested_by
       or new.reviewed_by is distinct from old.reviewed_by
       or new.accepted_by is distinct from old.accepted_by then
      raise exception 'Students cannot modify teacher-controlled fields';
    end if;
  end if;

  if not internal_flag and is_teacher and not is_student then
    if new.content is distinct from old.content
       or new.file_urls is distinct from old.file_urls
       or new.file_paths is distinct from old.file_paths
       or new.original_filenames is distinct from old.original_filenames then
      raise exception 'Teachers cannot edit student submission payloads';
    end if;
  end if;

  if is_teacher then
    if new.revision_requested_at is distinct from old.revision_requested_at then
      new.revision_requested_by := actor;
    end if;
    if new.reviewed_at is distinct from old.reviewed_at then
      new.reviewed_by := actor;
    end if;
  end if;

  new.file_paths := coalesce(new.file_paths, '{}'::text[]);
  new.original_filenames := coalesce(new.original_filenames, '{}'::text[]);

  return new;
end;
$$;

create or replace function public.after_update_homework_submission()
returns trigger
language plpgsql
as $$
declare
  status_now public.homework_status;
begin
  if new.is_latest is distinct from true then
    return new;
  end if;

  if new.revision_requested_at is not null
     and old.revision_requested_at is distinct from new.revision_requested_at then
    select status into status_now from public.homework where id = new.homework_id;
    if status_now not in ('submitted', 'needs_revision') then
      raise exception 'Cannot request revisions while homework is %', status_now;
    end if;
    perform public.internal_transition_homework(
      new.homework_id,
      'needs_revision',
      array['submitted', 'needs_revision']::public.homework_status[]
    );
  end if;

  if new.reviewed_at is not null
     and old.reviewed_at is distinct from new.reviewed_at then
    select status into status_now from public.homework where id = new.homework_id;
    if status_now not in ('submitted', 'reviewed') then
      raise exception 'Cannot review homework while it is %', status_now;
    end if;
    perform public.internal_transition_homework(
      new.homework_id,
      'reviewed',
      array['submitted', 'reviewed']::public.homework_status[]
    );
  end if;

  return new;
end;
$$;

-- 4) Drop the legacy enum now that nothing depends on it.
drop type public.homework_status_old;


