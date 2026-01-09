# Homework Workflow Contract

This document describes the **authoritative database contract** for Homework so the frontend never has to guess how state transitions happen.

## 1. State machine

```
assigned ──(student submits)──▶ submitted
submitted ──(teacher requests changes)──▶ needs_revision
needs_revision ──(student resubmits)──▶ submitted
submitted ──(teacher reviews + grades)──▶ reviewed

assigned ──(due date passes & no submission)──▶ overdue ──(student submits)──▶ submitted
```

*No other transitions exist.* Once `reviewed`, the homework is locked.

## 2. Frontend responsibilities

### Teachers **MAY**
- `INSERT` into `public.homework` (title, description, due_date, attachments via `homework_materials`).
- `UPDATE public.homework` for non-status fields (e.g. description, due_date) while status auto-guards are respected.
- `UPDATE public.homework_submissions` **only on the latest submission** to set:
  - `revision_requested_at` (requests changes — moves status to `needs_revision`)
  - `reviewed_at`, `grade`, `feedback` (reviews & grades — status `reviewed`)

### Students **MAY**
- `INSERT public.homework_submissions` with (`homework_id`, `student_id`, `content`).
- `UPDATE public.homework_submissions` they own to attach files (`file_paths`, `original_filenames`) or adjust narrative `content`.
- Upload files to Storage at:  
  `homework-submissions/{student_id}/{homework_id}/{submission_id}/{uuid}.{ext}`
  (filenames must be ASCII extensions; wrong paths are rejected).

### Frontend **MUST NOT**
- Set `public.homework.status` manually (any attempt is blocked by triggers).
- Modify `homework_submissions.attempt`, `is_latest`, `reviewed_*`, `accepted_*`, or `revision_requested_*` columns as a student.
- Allow new submissions when the homework is `reviewed` (DB will raise).
- Use user-provided or Unicode filenames for Storage object keys.

### Automatic server-side actions

| Event | Automatic behavior |
|-------|--------------------|
| Student inserts first submission | Attempts auto-increment, older submissions demoted, homework status becomes `submitted`, `first_submitted_at` recorded. |
| Teacher sets `revision_requested_at` (latest submission) | Status → `needs_revision`. |
| Student resubmits while `needs_revision`/`overdue`/`assigned` | Status → `submitted`, previous attempts marked `is_latest = false`. |
| Teacher sets `reviewed_at` | Status → `reviewed`. |
| Cron (`public.sync_overdue_homework`) | Every minute marks past-due + unsubmitted homework `overdue`, and reverts to `assigned` if the due date is extended before submission. |
| Storage policies | Enforce the folder layout, ensure students can only touch their own files, and let teachers read submissions they assigned. |

## 3. Minimal client flow

### Teacher assigns homework
1. `INSERT public.homework` with `teacher_id`, `student_id`, `title`, `description`, `due_date`.
2. Optionally `INSERT public.homework_materials` rows for attachments.

### Student submits
1. `INSERT public.homework_submissions` with `homework_id`, `student_id`, and textual content.
2. **After** the insert returns `submission.id`, upload files to Storage using the required path.
3. `UPDATE public.homework_submissions` to set `file_paths` / `original_filenames`.

### Teacher review loop
1. `UPDATE public.homework_submissions` (latest row only):
   - set `revision_requested_at = now()` to request changes, or
   - set `reviewed_at = now()`, `grade`, `feedback` to review/grade.
2. The database enforces that reviewed homework is immutable (no further submissions or edits).

## 4. Storage reminders

- Bucket: `homework-submissions` (always private).
- Key structure enforced server-side; invalid keys fail RLS checks.
- Students get full CRUD on their own submission folders; teachers receive read-only access for their homework.

By following this contract, the UI never needs to handle status logic itself—the database is the single source of truth. Document any future UI workflow changes against this contract before touching the tables.

