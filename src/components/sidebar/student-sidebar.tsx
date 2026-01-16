'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  GraduationCap,
  BookOpenCheck,
  MessageSquare,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store/app-store'
import { useEffect } from 'react'

const navItems = [
  { label: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
  { label: 'Calendar', href: '/student/calendar', icon: Calendar },
  { label: 'Lessons', href: '/student/lessons', icon: GraduationCap },
  { label: 'Homework', href: '/student/homework', icon: BookOpenCheck },
  { label: 'Messages', href: '/student/messages', icon: MessageSquare },
  { label: 'Settings', href: '/student/settings', icon: Settings },
  { label: 'Help', href: '/student/help', icon: LifeBuoy },
]

export function StudentSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { sidebarCollapsed, setSidebarCollapsed, toggleSidebarCollapsed } = useAppStore()

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('classcal.sidebarCollapsed')
      if (stored === '1') setSidebarCollapsed(true)
      if (stored === '0') setSidebarCollapsed(false)
    } catch {
      // ignore
    }
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
      toast.error('Failed to sign out. Please try again.')
      return
    }

    router.push('/login')
  }

  return (
    <aside
      className={cn(
        'border-r border-sidebar-border bg-sidebar flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className={cn('px-4 py-6 relative', sidebarCollapsed && 'px-2')}>
        {!sidebarCollapsed && (
          <>
            <p className="text-xs uppercase text-muted-foreground tracking-widest">
              Student Portal
            </p>
            <p className="text-lg font-semibold tracking-tight mt-1">ClassCal</p>
          </>
        )}
        {sidebarCollapsed && (
          <div className="flex items-center justify-center">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">CC</span>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleSidebarCollapsed}
          className={cn(
            'text-muted-foreground hover:text-foreground',
            sidebarCollapsed ? 'absolute right-2 top-3' : 'absolute right-3 top-3'
          )}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className={cn('flex-1 pb-6 space-y-1', sidebarCollapsed ? 'px-2' : 'px-2')}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className={cn(
                      'flex items-center justify-center rounded-lg py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          }

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

      <div className="border-t border-sidebar-border px-4 py-4">
        {sidebarCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Sign out"
                className="w-full"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Sign out
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-sm"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </Button>
        )}
      </div>
    </aside>
  )
}


