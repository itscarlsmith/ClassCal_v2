type NotificationRole = 'teacher' | 'student'
type NotificationType =
  | 'lesson_upcoming_reminder'
  | 'lesson_changed'
  | 'lesson_scheduled_by_teacher'
  | 'lesson_accepted_or_denied_by_student'
  | 'lesson_booked_by_student'
  | 'homework_assigned'
  | 'homework_due_soon'
  | 'homework_submitted'
  | 'message_received'
  | 'credit_threshold_reached'

const priorityByType: Record<NotificationType, number> = {
  lesson_upcoming_reminder: 2,
  lesson_changed: 3,
  lesson_scheduled_by_teacher: 3,
  lesson_accepted_or_denied_by_student: 3,
  lesson_booked_by_student: 3,
  homework_assigned: 2,
  homework_due_soon: 2,
  homework_submitted: 1,
  message_received: 3,
  credit_threshold_reached: 2,
}

const allowedRolesByType: Record<NotificationType, NotificationRole[]> = {
  lesson_upcoming_reminder: ['teacher', 'student'],
  lesson_changed: ['teacher', 'student'],
  lesson_scheduled_by_teacher: ['student'],
  lesson_accepted_or_denied_by_student: ['teacher'],
  lesson_booked_by_student: ['teacher'],
  homework_assigned: ['student'],
  homework_due_soon: ['student'],
  homework_submitted: ['teacher'],
  message_received: ['teacher', 'student'],
  credit_threshold_reached: ['teacher', 'student'],
}

export function getNotificationPriority(type: string): number {
  return priorityByType[type as NotificationType] ?? 0
}

export function isNotificationVisibleForRole(
  role: NotificationRole,
  type: string
): boolean {
  const allowedRoles = allowedRolesByType[type as NotificationType]
  if (!allowedRoles) return true
  return allowedRoles.includes(role)
}
