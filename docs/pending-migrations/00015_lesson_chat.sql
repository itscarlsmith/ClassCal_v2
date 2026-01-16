-- Pending (not applied yet): lesson-scoped chat extensions
-- This file was split out from 00014 to keep group lessons and chat schema changes independent.
-- When ready to ship lesson-scoped chat fields/policies, move this into a numbered migration.

-- ----------------------------------------------------
-- Lesson-scoped chat using existing messages subsystem
-- ----------------------------------------------------
alter table public.message_threads
  add column if not exists lesson_id uuid references public.lessons(id) on delete cascade;

create unique index if not exists message_threads_lesson_unique
  on public.message_threads (lesson_id)
  where lesson_id is not null;

alter table public.messages
  add column if not exists lesson_id uuid references public.lessons(id) on delete cascade;

alter table public.messages
  alter column recipient_id drop not null;

drop policy if exists "View own threads" on public.message_threads;
drop policy if exists "Create threads" on public.message_threads;
drop policy if exists "Update threads" on public.message_threads;

drop policy if exists "View own messages" on public.messages;
drop policy if exists "Send messages" on public.messages;
drop policy if exists "Update own messages" on public.messages;

create policy "Access direct or lesson threads"
on public.message_threads
for select
using (
  auth.uid() = any(participant_ids)
  or (
    lesson_id is not null
    and (
      exists (
        select 1
        from public.lessons l
        where l.id = public.message_threads.lesson_id
          and l.teacher_id = auth.uid()
      )
      or exists (
        select 1
        from public.lesson_students ls
        join public.students s
          on s.id = ls.student_id
        where ls.lesson_id = public.message_threads.lesson_id
          and s.user_id = auth.uid()
      )
    )
  )
);

create policy "Manage accessible threads"
on public.message_threads
for insert
with check (
  auth.uid() = any(participant_ids)
  or (
    lesson_id is not null
    and exists (
      select 1
      from public.lessons l
      where l.id = public.message_threads.lesson_id
        and l.teacher_id = auth.uid()
    )
  )
);

create policy "Update accessible threads"
on public.message_threads
for update
using (
  auth.uid() = any(participant_ids)
  or (
    lesson_id is not null
    and (
      exists (
        select 1
        from public.lessons l
        where l.id = public.message_threads.lesson_id
          and l.teacher_id = auth.uid()
      )
      or exists (
        select 1
        from public.lesson_students ls
        join public.students s
          on s.id = ls.student_id
        where ls.lesson_id = public.message_threads.lesson_id
          and s.user_id = auth.uid()
      )
    )
  )
)
with check (
  auth.uid() = any(participant_ids)
  or (
    lesson_id is not null
    and exists (
      select 1
      from public.lessons l
      where l.id = public.message_threads.lesson_id
        and l.teacher_id = auth.uid()
    )
  )
);

create policy "View direct or lesson messages"
on public.messages
for select
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or (
    lesson_id is not null
    and (
      exists (
        select 1
        from public.lessons l
        where l.id = public.messages.lesson_id
          and l.teacher_id = auth.uid()
      )
      or exists (
        select 1
        from public.lesson_students ls
        join public.students s
          on s.id = ls.student_id
        where ls.lesson_id = public.messages.lesson_id
          and s.user_id = auth.uid()
      )
    )
  )
);

create policy "Send direct or lesson messages"
on public.messages
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.message_threads mt
    where mt.id = public.messages.thread_id
      and (
        auth.uid() = any(mt.participant_ids)
        or (
          mt.lesson_id is not null
          and (
            exists (
              select 1
              from public.lessons l
              where l.id = mt.lesson_id
                and l.teacher_id = auth.uid()
            )
            or exists (
              select 1
              from public.lesson_students ls
              join public.students s
                on s.id = ls.student_id
              where ls.lesson_id = mt.lesson_id
                and s.user_id = auth.uid()
            )
          )
        )
      )
  )
  and (
    public.messages.lesson_id is null
    or exists (
      select 1
      from public.message_threads mt2
      where mt2.id = public.messages.thread_id
        and mt2.lesson_id = public.messages.lesson_id
    )
  )
);

create policy "Update own or accessible messages"
on public.messages
for update
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or (
    lesson_id is not null
    and (
      exists (
        select 1
        from public.lessons l
        where l.id = public.messages.lesson_id
          and l.teacher_id = auth.uid()
      )
      or exists (
        select 1
        from public.lesson_students ls
        join public.students s
          on s.id = ls.student_id
        where ls.lesson_id = public.messages.lesson_id
          and s.user_id = auth.uid()
      )
    )
  )
);
