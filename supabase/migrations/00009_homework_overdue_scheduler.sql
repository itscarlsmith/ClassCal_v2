-- ===========================================================
-- 00009_homework_overdue_scheduler.sql
-- Persists overdue homework state via pg_cron.
-- ===========================================================

create extension if not exists pg_cron with schema extensions;

create or replace function public.sync_overdue_homework()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('classcal.homework_status_bypass', 'true', true);
  begin
    update public.homework h
       set status = 'overdue'
     where status = 'assigned'
       and due_date < now()
       and not exists (
         select 1
           from public.homework_submissions s
          where s.homework_id = h.id
       );

    update public.homework h
       set status = 'assigned'
     where status = 'overdue'
       and due_date >= now()
       and not exists (
         select 1
           from public.homework_submissions s
          where s.homework_id = h.id
       );
  exception
    when others then
      perform set_config('classcal.homework_status_bypass', 'false', true);
      raise;
  end;
  perform set_config('classcal.homework_status_bypass', 'false', true);
end;
$$;

select cron.unschedule('homework_overdue_sync') where exists (
  select 1
    from cron.job
   where jobname = 'homework_overdue_sync'
);

select cron.schedule(
  'homework_overdue_sync',
  '*/1 * * * *',
  $$select public.sync_overdue_homework();$$
);


