-- ===========================================================
-- 00021_update_lesson_end_time_automation_order.sql
-- Process pending expiries before confirmed auto-completions
-- ===========================================================

create or replace function public.sync_lesson_end_transitions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select l.id, l.teacher_id, l.student_id, l.title, l.status
    from public.lessons l
    where l.status in ('pending', 'confirmed')
      and l.end_time <= now() - interval '5 minutes'
    order by
      case when l.status = 'pending' then 0 else 1 end,
      l.end_time asc
  loop
    begin
      if not exists (
        select 1
        from public.credit_ledger cl
        where cl.lesson_id = rec.id
          and cl.type = 'reserve'
      ) then
        insert into public.credit_ledger (student_id, teacher_id, amount, description, lesson_id, type)
        values (
          rec.student_id,
          rec.teacher_id,
          -1,
          'Lesson reserved (auto backfill): ' || rec.title,
          rec.id,
          'reserve'
        );
      end if;

      if rec.status = 'pending' then
        update public.lessons
           set status = 'cancelled'
         where id = rec.id
           and status = 'pending';
      elsif rec.status = 'confirmed' then
        update public.lessons
           set status = 'completed'
         where id = rec.id
           and status = 'confirmed';
      end if;
    exception
      when others then
        if sqlerrm = 'credit_balance_negative' then
          null;
        else
          raise;
        end if;
    end;
  end loop;
end;
$$;

