'use client'

import { usePathname } from 'next/navigation'

const studentSections: Array<{ prefix: string; label: string }> = [
  { prefix: '/student/dashboard', label: 'Dashboard' },
  { prefix: '/student/calendar', label: 'Calendar' },
  { prefix: '/student/lessons', label: 'Lessons' },
  { prefix: '/student/homework', label: 'Homework' },
  { prefix: '/student/messages', label: 'Messages' },
  { prefix: '/student/finance', label: 'Finance' },
  { prefix: '/student/settings', label: 'Settings' },
  { prefix: '/student/help', label: 'Help' },
]

const teacherSections: Array<{ prefix: string; label: string }> = [
  { prefix: '/teacher/dashboard', label: 'Dashboard' },
  { prefix: '/teacher/calendar', label: 'Calendar' },
  { prefix: '/teacher/lessons', label: 'Lessons' },
  { prefix: '/teacher/students', label: 'Students' },
  { prefix: '/teacher/homework', label: 'Homework' },
  { prefix: '/teacher/messages', label: 'Messages' },
  { prefix: '/teacher/library', label: 'Library' },
  { prefix: '/teacher/finance', label: 'Finance' },
  { prefix: '/teacher/automation', label: 'Automation' },
  { prefix: '/teacher/settings', label: 'Settings' },
  { prefix: '/teacher/help', label: 'Help' },
  { prefix: '/teacher/stripe', label: 'Settings' },
]

function getSectionLabel(pathname: string): string {
  if (pathname.startsWith('/teacher/')) {
    for (const rule of teacherSections) {
      if (pathname.startsWith(rule.prefix)) return rule.label
    }
    return 'Dashboard'
  }

  for (const rule of studentSections) {
    if (pathname.startsWith(rule.prefix)) return rule.label
  }

  return 'Dashboard'
}

export function useActiveSection(): string {
  const pathname = usePathname()
  return getSectionLabel(pathname)
}
