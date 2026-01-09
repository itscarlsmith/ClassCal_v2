-- Ensure materials bucket exists (private by default)
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

alter table if exists storage.objects enable row level security;

-- Clean up existing policies if this script is re-run
drop policy if exists "Teachers manage material files" on storage.objects;
drop policy if exists "Authorized users read material files" on storage.objects;

-- Teachers can manage (insert/update/delete) files that belong to their materials
create policy "Teachers manage material files"
on storage.objects
for all
using (
  bucket_id = 'materials'
  and exists (
    select 1
    from public.materials m
    where m.id = split_part(storage.objects.name, '/', 2)
      and m.teacher_id = auth.uid()
  )
)
with check (
  bucket_id = 'materials'
  and exists (
    select 1
    from public.materials m
    where m.id = split_part(storage.objects.name, '/', 2)
      and m.teacher_id = auth.uid()
  )
);

-- Teachers + students attached to the material via lessons/homework may read files
create policy "Authorized users read material files"
on storage.objects
for select
using (
  bucket_id = 'materials'
  and (
    -- Teacher owner
    exists (
      select 1
      from public.materials m
      where m.id = split_part(storage.objects.name, '/', 2)
        and m.teacher_id = auth.uid()
    )
    -- Lesson attachment
    or exists (
      select 1
      from public.materials m
      join public.lesson_materials lm on lm.material_id = m.id
      join public.lessons l on l.id = lm.lesson_id
      join public.students s on s.id = l.student_id
      where m.id = split_part(storage.objects.name, '/', 2)
        and s.user_id = auth.uid()
    )
    -- Homework attachment
    or exists (
      select 1
      from public.materials m
      join public.homework_materials hm on hm.material_id = m.id
      join public.homework h on h.id = hm.homework_id
      join public.students s2 on s2.id = h.student_id
      where m.id = split_part(storage.objects.name, '/', 2)
        and s2.user_id = auth.uid()
    )
  )
);
