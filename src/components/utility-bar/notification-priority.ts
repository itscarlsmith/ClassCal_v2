export function getNotificationPriority(type: string): number {
  const normalized = type.toLowerCase()
  if (normalized.includes('lesson')) return 3
  if (normalized.includes('homework')) return 2
  if (normalized.includes('message')) return 1
  if (normalized.includes('credit')) return 0
  return -1
}

export function isNotificationVisibleForRole(
  role: 'teacher' | 'student',
  type: string
): boolean {
  const normalized = type.toLowerCase()
  const allowed = ['lesson', 'homework', 'message', 'credit'].some((category) =>
    normalized.includes(category)
  )

  if (!allowed) return false

  if (role === 'student') {
    if (normalized.includes('finance')) return false
    if (normalized.includes('student_activity')) return false
    if (normalized.includes('student-activity')) return false
  }

  return true
}
