-- ===========================================================
-- 00020_fix_lesson_end_time_automation.sql
-- Make end-time automation resilient to legacy lessons
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
    order by l.end_time asc
  loop
    begin
      -- Ensure a reserve exists so closeouts (return/consume) can be written safely.
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
      -- If we can't reserve because balance would go negative, skip this lesson
      -- so other lessons can still be processed.
      when others then
        if sqlerrm = 'credit_balance_negative' then
          -- Skip this lesson
          null;
        else
          raise;
        end if;
    end;
  end loop;
end;
$$;

