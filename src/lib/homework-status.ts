import type { HomeworkStatus } from '@/types/database'

export type DisplayHomeworkStatus = HomeworkStatus

const BADGE_MAP: Record<DisplayHomeworkStatus | 'overdue', string> = {
  assigned: 'badge-pending',
  submitted: 'badge-info',
  reviewed: 'badge-success',
  cancelled: 'badge-cancelled',
  needs_revision: 'badge-warning',
  overdue: 'badge-overdue',
}

/**
 * Normalizes any server-provided status so legacy or unknown values
 * never leak into the UI. Legacy `completed` maps to `reviewed`.
 */
export function normalizeHomeworkStatus(status: string | null | undefined): HomeworkStatus {
  const normalized = (status || '').toLowerCase()
  switch (normalized) {
    case 'assigned':
    case 'submitted':
    case 'needs_revision':
    case 'reviewed':
    case 'overdue':
    case 'cancelled':
      return normalized
    case 'completed':
      return 'reviewed'
    default:
      return 'assigned'
  }
}

function coerceDate(dueDate?: string | Date | null): Date | null {
  if (!dueDate) return null
  if (dueDate instanceof Date) return isNaN(dueDate.getTime()) ? null : dueDate
  const parsed = new Date(dueDate)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Determines whether the homework should be shown as overdue.
 * Explicit `overdue` status wins. Otherwise, `assigned` or `needs_revision`
 * past their due date count as overdue for display purposes.
 */
export function isHomeworkOverdue(statusInput: HomeworkStatus, dueDate?: string | Date | null, now = new Date()) {
  const status = normalizeHomeworkStatus(statusInput)
  if (status === 'overdue') return true
  if (!dueDate) return false
  const due = coerceDate(dueDate)
  if (!due) return false
  if (status === 'assigned' || status === 'needs_revision') {
    return due.getTime() < now.getTime()
  }
  return false
}

/**
 * Provides the status the UI should rely on after considering overdue logic.
 */
export function effectiveHomeworkStatus(
  statusInput: HomeworkStatus | string,
  dueDate?: string | Date | null,
  now = new Date()
): DisplayHomeworkStatus | 'overdue' {
  const status = normalizeHomeworkStatus(statusInput)
  if (isHomeworkOverdue(status, dueDate, now)) {
    return 'overdue'
  }
  return status
}

/**
 * Returns the badge class that should be used everywhere in the UI
 * to keep homework status colors consistent.
 */
export function badgeClassForHomeworkStatus(status: HomeworkStatus | string, dueDate?: string | Date | null) {
  const effective = effectiveHomeworkStatus(status, dueDate)
  return BADGE_MAP[effective] || 'badge-pending'
}

type HomeworkRole = 'teacher' | 'student'

const ROLE_LABELS: Record<HomeworkRole, Record<DisplayHomeworkStatus | 'overdue', { label: string; badge: string }>> = {
  teacher: {
    assigned: { label: 'Assigned', badge: 'badge-info' },
    submitted: { label: 'To Review', badge: 'badge-warning' },
    needs_revision: { label: 'Needs revision', badge: 'badge-warning' },
    reviewed: { label: 'Reviewed', badge: 'badge-success' },
    overdue: { label: 'Overdue', badge: 'badge-overdue' },
    cancelled: { label: 'Cancelled', badge: 'badge-cancelled' },
  },
  student: {
    assigned: { label: 'To Do', badge: 'badge-warning' },
    needs_revision: { label: 'To Do', badge: 'badge-warning' },
    submitted: { label: 'Submitted', badge: 'badge-info' },
    reviewed: { label: 'Reviewed', badge: 'badge-success' },
    overdue: { label: 'Overdue', badge: 'badge-overdue' },
    cancelled: { label: 'Cancelled', badge: 'badge-cancelled' },
  },
}

/**
 * Returns the label + badge class for the given status, tailored per role.
 */
export function presentHomeworkStatus({
  status,
  dueDate,
  role,
  now = new Date(),
}: {
  status: HomeworkStatus | string
  dueDate?: string | Date | null
  role: HomeworkRole
  now?: Date
}) {
  const effective = effectiveHomeworkStatus(status, dueDate, now)
  if (effective === 'overdue') {
    return ROLE_LABELS[role].overdue
  }
  return ROLE_LABELS[role][effective] ?? ROLE_LABELS[role].assigned
}

