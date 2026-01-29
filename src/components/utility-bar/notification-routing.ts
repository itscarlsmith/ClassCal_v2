import type { Notification } from '@/types/database'

export function getNotificationHref(
  notification: Notification,
  role: 'teacher' | 'student'
): string {
  const base = role === 'teacher' ? '/teacher' : '/student'
  const data = notification.data

  if (data && typeof data === 'object' && 'href' in data) {
    const href = (data as Record<string, unknown>).href
    if (typeof href === 'string' && href.length > 0) {
      return href
    }
  }

  const type = (notification.notification_type || notification.type || '').toString()
  switch (type) {
    case 'lesson_upcoming_reminder':
    case 'lesson_changed':
    case 'lesson_scheduled_by_teacher':
    case 'lesson_accepted_or_denied_by_student':
    case 'lesson_booked_by_student':
      return `${base}/lessons`
    case 'homework_assigned':
    case 'homework_due_soon':
    case 'homework_submitted':
      return `${base}/homework`
    case 'message_received':
      return `${base}/messages`
    case 'credit_threshold_reached':
      return role === 'teacher' ? '/teacher/students' : '/student/finance'
    default:
      break
  }

  return `${base}/dashboard`
}
