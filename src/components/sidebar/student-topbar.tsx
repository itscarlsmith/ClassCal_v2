'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

const topbarClassName =
  'h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 flex items-center justify-between'

function getStudentPageTitle(pathname: string) {
  if (pathname.startsWith('/student/calendar')) return 'Calendar'
  if (pathname.startsWith('/student/finance')) return 'Finance'
  if (pathname.startsWith('/student/lessons')) return 'Lessons'
  if (pathname.startsWith('/student/homework')) return 'Homework'
  if (pathname.startsWith('/student/messages')) return 'Messages'
  if (pathname.startsWith('/student/settings')) return 'Settings'
  if (pathname.startsWith('/student/help')) return 'Help'
  return 'Student'
}

export function StudentTopbar() {
  const pathname = usePathname()
  const title = getStudentPageTitle(pathname)

  return (
    <header className={topbarClassName}>
      <div>
        <p className="text-xs uppercase text-muted-foreground tracking-widest">
          Student workspace
        </p>
        <p className="text-base md:text-lg font-semibold text-foreground">
          {title}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="w-4 h-4" />
          <span className="sr-only">Notifications</span>
        </Button>
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
          S
        </div>
      </div>
    </header>
  )
}

