-- ===========================================================
-- 00019_lesson_end_time_automation.sql
-- Auto-transition lessons based on end_time
-- ===========================================================

create extension if not exists pg_cron with schema extensions;

create or replace function public.sync_lesson_end_transitions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Expire pending lessons after grace period
  update public.lessons
     set status = 'cancelled'
   where status = 'pending'
     and end_time <= now() - interval '5 minutes';

  -- Auto-complete confirmed lessons after grace period
  update public.lessons
     set status = 'completed'
   where status = 'confirmed'
     and end_time <= now() - interval '5 minutes';
end;
$$;

select cron.unschedule('lesson_end_transitions') where exists (
  select 1
    from cron.job
   where jobname = 'lesson_end_transitions'
);

select cron.schedule(
  'lesson_end_transitions',
  '*/5 * * * *',
  $$select public.sync_lesson_end_transitions();$$
);
