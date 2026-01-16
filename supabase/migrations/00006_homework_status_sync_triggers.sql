-- Ensure homework status automatically reflects submission/review events

create or replace function public.set_homework_status_on_submission()
returns trigger
language plpgsql
as $$
begin
  if new.is_latest is distinct from true then
    return new;
  end if;

  update public.homework
     set status = 'submitted'
   where id = new.homework_id
     and status in ('assigned', 'needs_revision', 'overdue', 'submitted');

  return new;
end;
$$;

drop trigger if exists trg_homework_submission_status on public.homework_submissions;
create trigger trg_homework_submission_status
after insert on public.homework_submissions
for each row
execute function public.set_homework_status_on_submission();


create or replace function public.set_homework_status_on_review()
returns trigger
language plpgsql
as $$
begin
  if new.is_latest is distinct from true then
    return new;
  end if;

  if new.reviewed_at is null then
    return new;
  end if;

  update public.homework
     set status = 'completed'
   where id = new.homework_id
     and status in ('submitted', 'needs_revision', 'overdue', 'reviewed');

  return new;
end;
$$;

drop trigger if exists trg_homework_review_status on public.homework_submissions;
create trigger trg_homework_review_status
after update on public.homework_submissions
for each row
when (new.reviewed_at is not null and coalesce(old.reviewed_at, timestamptz '1970-01-01') is distinct from new.reviewed_at)
execute function public.set_homework_status_on_review();

