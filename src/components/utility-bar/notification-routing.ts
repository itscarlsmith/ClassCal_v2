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

  const normalized = notification.type.toLowerCase()
  if (normalized.includes('lesson')) return `${base}/lessons`
  if (normalized.includes('homework')) return `${base}/homework`
  if (normalized.includes('message')) return `${base}/messages`
  if (normalized.includes('credit')) return `${base}/finance`

  return `${base}/dashboard`
}
