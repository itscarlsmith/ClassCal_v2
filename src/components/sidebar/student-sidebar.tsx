'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  GraduationCap,
  BookOpenCheck,
  MessageSquare,
  Settings,
  LifeBuoy,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Calendar', href: '/student/calendar', icon: Calendar },
  { label: 'Lessons', href: '/student/lessons', icon: GraduationCap },
  { label: 'Homework', href: '/student/homework', icon: BookOpenCheck },
  { label: 'Messages', href: '/student/messages', icon: MessageSquare },
  { label: 'Settings', href: '/student/settings', icon: Settings },
  { label: 'Help', href: '/student/help', icon: LifeBuoy },
]

export function StudentSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div className="px-4 py-6">
        <p className="text-xs uppercase text-muted-foreground tracking-widest">
          Student Portal
        </p>
        <p className="text-lg font-semibold tracking-tight mt-1">ClassCal</p>
      </div>
      <nav className="flex-1 px-2 pb-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

