-- ===========================================================
-- 00011_homework_submission_storage.sql
-- Locks down the homework-submissions bucket with UUID-only keys
-- and strict per-role access controls.
-- ===========================================================

insert into storage.buckets (id, name, public)
values ('homework-submissions', 'homework-submissions', false)
on conflict (id) do nothing;

-- Helper: return the UUID located at a specific segment in the key.
create or replace function public.homework_submission_path_uuid(p_name text, p_idx int)
returns uuid
language plpgsql
immutable
as $$
declare
  parts text[];
  parts_len int;
begin
  if p_name is null then
    return null;
  end if;
  parts := string_to_array(p_name, '/');
  parts_len := coalesce(array_length(parts, 1), 0);
  if p_idx < 1 or p_idx > parts_len then
    return null;
  end if;
  begin
    return parts[p_idx]::uuid;
  exception
    when others then
      return null;
  end;
end;
$$;

-- Helper: validates the entire key structure.
create or replace function public.homework_submission_storage_key_valid(p_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  parts text[];
  parts_len int;
  file_part text;
  file_uuid text;
  file_ext text;
begin
  if p_name is null then
    return false;
  end if;

  parts := string_to_array(p_name, '/');
  parts_len := coalesce(array_length(parts, 1), 0);
  if parts_len <> 4 then
    return false;
  end if;

  begin
    perform parts[1]::uuid;
    perform parts[2]::uuid;
    perform parts[3]::uuid;
  exception
    when others then
      return false;
  end;

  file_part := parts[4];
  if file_part is null or position('.' in file_part) = 0 then
    return false;
  end if;

  file_uuid := split_part(file_part, '.', 1);
  file_ext := lower(split_part(file_part, '.', 2));

  begin
    perform file_uuid::uuid;
  exception
    when others then
      return false;
  end;

  if file_ext !~ '^[a-z0-9]+$' then
    return false;
  end if;

  return true;
end;
$$;

drop policy if exists "Students manage submission files" on storage.objects;
drop policy if exists "Students read submission files" on storage.objects;
drop policy if exists "Teachers read submission files" on storage.objects;

-- Students: insert/update/delete their own submission files
create policy "Students manage submission files"
on storage.objects
for all
using (
  bucket_id = 'homework-submissions'
  and public.homework_submission_storage_key_valid(name)
  and exists (
    select 1
      from public.homework_submissions hs
      join public.students s
        on s.id = hs.student_id
     where hs.id = public.homework_submission_path_uuid(storage.objects.name, 3)
       and hs.homework_id = public.homework_submission_path_uuid(storage.objects.name, 2)
       and s.id = public.homework_submission_path_uuid(storage.objects.name, 1)
       and s.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'homework-submissions'
  and public.homework_submission_storage_key_valid(name)
  and exists (
    select 1
      from public.homework_submissions hs
      join public.students s
        on s.id = hs.student_id
     where hs.id = public.homework_submission_path_uuid(storage.objects.name, 3)
       and hs.homework_id = public.homework_submission_path_uuid(storage.objects.name, 2)
       and s.id = public.homework_submission_path_uuid(storage.objects.name, 1)
       and s.user_id = auth.uid()
  )
);

-- Students: read their own submission files
create policy "Students read submission files"
on storage.objects
for select
using (
  bucket_id = 'homework-submissions'
  and public.homework_submission_storage_key_valid(name)
  and exists (
    select 1
      from public.homework_submissions hs
      join public.students s
        on s.id = hs.student_id
     where hs.id = public.homework_submission_path_uuid(storage.objects.name, 3)
       and hs.homework_id = public.homework_submission_path_uuid(storage.objects.name, 2)
       and s.id = public.homework_submission_path_uuid(storage.objects.name, 1)
       and s.user_id = auth.uid()
  )
);

-- Teachers: read files for homework they own
create policy "Teachers read submission files"
on storage.objects
for select
using (
  bucket_id = 'homework-submissions'
  and public.homework_submission_storage_key_valid(name)
  and exists (
    select 1
      from public.homework_submissions hs
      join public.homework h
        on h.id = hs.homework_id
     where hs.id = public.homework_submission_path_uuid(storage.objects.name, 3)
       and hs.homework_id = public.homework_submission_path_uuid(storage.objects.name, 2)
       and h.teacher_id = auth.uid()
  )
);


