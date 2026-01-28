'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { GlobalSearch } from './global-search'
import { NotificationsMenu } from './notifications-menu'
import { AccountMenu } from './account-menu'
import { SectionLabel } from './section-label'
import { useActiveSection } from './use-active-section'

const topbarClassName =
  'h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 flex items-center justify-between'

export function GlobalUtilityBar() {
  const pathname = usePathname()
  const user = useAppStore((state) => state.user)
  const sectionLabel = useActiveSection()

  const role = useMemo<'teacher' | 'student'>(() => {
    if (user?.role === 'teacher' || user?.role === 'student') return user.role
    return pathname.startsWith('/teacher/') ? 'teacher' : 'student'
  }, [pathname, user?.role])

  return (
    <header className={topbarClassName} style={{ height: 'var(--utility-bar-height)' }}>
      <SectionLabel label={sectionLabel} />
      <GlobalSearch role={role} />
      <div className="flex items-center gap-2">
        <NotificationsMenu role={role} userId={user?.id ?? null} />
        <AccountMenu role={role} user={user} />
      </div>
    </header>
  )
}
