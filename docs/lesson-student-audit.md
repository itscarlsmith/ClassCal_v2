## Pre-migration audit for `lesson_students`

Run these queries before applying migration `00017`.

### 1) Check for lessons with multiple `lesson_students` rows

```sql
select lesson_id, count(*) as participant_count
from public.lesson_students
group by lesson_id
having count(*) > 1
order by participant_count desc;
```

### 2) Find `lesson_students` rows that do not match `lessons.student_id`

```sql
select ls.lesson_id,
       ls.student_id as participant_student_id,
       l.student_id as primary_student_id
from public.lesson_students ls
join public.lessons l on l.id = ls.lesson_id
where ls.student_id is distinct from l.student_id;
```

### Decision point

- If both queries return zero rows, apply migration `00017` directly.
- If either query returns rows, decide on one of the following before applying:
  - Cancel those lessons, or
  - Convert them to 1-on-1 by keeping only `lessons.student_id`, or
  - Split them into separate 1-on-1 lessons (only if scheduling and credit logic is acceptable).
