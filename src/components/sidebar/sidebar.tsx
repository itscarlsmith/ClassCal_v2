'use client'

import { useEffect, useState } from 'react'
import { 
  LayoutDashboard, 
  Calendar, 
  GraduationCap, 
  Users, 
  BookOpen, 
  MessageSquare, 
  FolderOpen, 
  DollarSign, 
  Zap, 
  Settings, 
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { NavItem, NavSubItem } from './nav-item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

// ClassCal Logo Component
function ClassCalLogo({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'relative flex items-center px-3 py-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}
    >
      <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
        <svg 
          viewBox="0 0 24 24" 
          className="w-5 h-5 text-primary-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
        </svg>
        </div>
        {!collapsed && <span className="text-lg font-semibold tracking-tight">ClassCal</span>}
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggle}
        className={cn(
          'text-muted-foreground hover:text-foreground',
          collapsed ? 'absolute right-2 top-3' : ''
        )}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
    </div>
  )
}

export function Sidebar() {
  const teacherHref = (path: string) => `/teacher${path}`
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { sidebarCollapsed, setSidebarCollapsed, toggleSidebarCollapsed } = useAppStore()

  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const [needsRevisionHomeworkCount, setNeedsRevisionHomeworkCount] = useState(0)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('classcal.sidebarCollapsed')
      if (stored === '1') setSidebarCollapsed(true)
      if (stored === '0') setSidebarCollapsed(false)
    } catch {
      // ignore
    }
    // only on mount
  }, [setSidebarCollapsed])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    let cancelled = false

    const loadBadges = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) return

      const [{ count: unreadCount }, { count: needsRevisionCount }] = await Promise.all([
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false),
        supabase
          .from('homework')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id)
          .eq('status', 'needs_revision'),
      ])

      if (cancelled) return

      setUnreadMessagesCount(unreadCount ?? 0)
      setNeedsRevisionHomeworkCount(needsRevisionCount ?? 0)
    }

    loadBadges()

    return () => {
      cancelled = true
    }
    // Recompute on navigation so counts update after visiting inbox/review pages.
  }, [pathname, supabase])

  return (
    <aside
      className={cn(
        'h-screen flex flex-col border-r border-sidebar-border bg-sidebar overflow-hidden transition-[width] duration-200 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <ClassCalLogo collapsed={sidebarCollapsed} onToggle={toggleSidebarCollapsed} />

      <ScrollArea className={cn('flex-1 min-h-0', sidebarCollapsed ? 'px-2' : 'px-3')}>
        <nav className="space-y-1 pb-4">
          {/* Dashboard */}
          <NavItem 
            label="Dashboard" 
            icon={<LayoutDashboard className="w-5 h-5" />}
            sectionKey="dashboard"
          >
            <NavSubItem label="Overview" href={teacherHref('/dashboard')} />
          </NavItem>
          
          {/* Calendar */}
          <NavItem 
            label="Calendar" 
            icon={<Calendar className="w-5 h-5" />}
            sectionKey="calendar"
          >
            <NavSubItem label="Calendar" href={teacherHref('/calendar')} />
            <NavSubItem label="Availability" href={teacherHref('/calendar/availability')} />
            <NavSubItem label="Scheduling Rules" href={teacherHref('/calendar/rules')} />
            <NavSubItem label="Calendar Sync" href={teacherHref('/calendar/sync')} />
          </NavItem>
          
          {/* Lessons */}
          <NavItem 
            label="Lessons" 
            icon={<GraduationCap className="w-5 h-5" />}
            sectionKey="lessons"
          >
            <NavSubItem label="Upcoming Lessons" href={teacherHref('/lessons')} />
            <NavSubItem label="Past Lessons" href={teacherHref('/lessons/past')} />
            <NavSubItem label="Recordings" href={teacherHref('/lessons/recordings')} />
            <NavSubItem label="Lesson Notes" href={teacherHref('/lessons/notes')} />
            <NavSubItem label="Lesson Templates" href={teacherHref('/lessons/templates')} />
          </NavItem>
          
          {/* Students */}
          <NavItem 
            label="Students" 
            icon={<Users className="w-5 h-5" />}
            sectionKey="students"
          >
            <NavSubItem label="Overview" href={teacherHref('/students')} />
            <NavSubItem label="Student List" href={teacherHref('/students/list')} />
            <NavSubItem label="Progress" href={teacherHref('/students/progress')} />
            <NavSubItem label="Lesson Notes" href={teacherHref('/students/notes')} />
            <NavSubItem label="Homework" href={teacherHref('/students/homework')} />
            <NavSubItem label="Files" href={teacherHref('/students/files')} />
            <NavSubItem label="Payments" href={teacherHref('/students/payments')} />
            <NavSubItem label="Parents" href={teacherHref('/students/parents')} />
          </NavItem>
          
          {/* Homework */}
          <NavItem 
            label="Homework" 
            icon={<BookOpen className="w-5 h-5" />}
            sectionKey="homework"
            badge={needsRevisionHomeworkCount}
          >
            <NavSubItem label="All Assignments" href={teacherHref('/homework')} />
            <NavSubItem
              label="To Review"
              href={teacherHref('/homework/review')}
              badge={needsRevisionHomeworkCount}
            />
            <NavSubItem label="Submitted" href={teacherHref('/homework/submitted')} />
            <NavSubItem label="Overdue" href={teacherHref('/homework/overdue')} />
            <NavSubItem label="Templates" href={teacherHref('/homework/templates')} />
          </NavItem>
          
          {/* Messages */}
          <NavItem 
            label="Messages" 
            icon={<MessageSquare className="w-5 h-5" />}
            sectionKey="messages"
            badge={unreadMessagesCount}
          >
            <NavSubItem
              label="Inbox"
              href={teacherHref('/messages')}
              badge={unreadMessagesCount}
            />
            <NavSubItem label="Students" href={teacherHref('/messages/students')} />
            <NavSubItem label="Parents" href={teacherHref('/messages/parents')} />
            <NavSubItem label="Groups" href={teacherHref('/messages/groups')} />
          </NavItem>
          
          {/* Library */}
          <NavItem 
            label="Library" 
            icon={<FolderOpen className="w-5 h-5" />}
            sectionKey="library"
          >
            <NavSubItem label="All Materials" href={teacherHref('/library')} />
            <NavSubItem label="Flashcards" href={teacherHref('/library/flashcards')} />
            <NavSubItem label="Quizzes" href={teacherHref('/library/quizzes')} />
            <NavSubItem label="Worksheets" href={teacherHref('/library/worksheets')} />
            <NavSubItem label="Uploads" href={teacherHref('/library/uploads')} />
          </NavItem>
          
          {/* Finance */}
          <NavItem 
            label="Finance" 
            icon={<DollarSign className="w-5 h-5" />}
            sectionKey="finance"
          >
            <NavSubItem label="Overview" href={teacherHref('/finance')} />
            <NavSubItem label="Invoices" href={teacherHref('/finance/invoices')} />
            <NavSubItem label="Payments" href={teacherHref('/finance/payments')} />
            <NavSubItem label="Payouts" href={teacherHref('/finance/payouts')} />
            <NavSubItem label="Packages" href={teacherHref('/finance/packages')} />
            <NavSubItem label="Transactions" href={teacherHref('/finance/transactions')} />
            <NavSubItem label="Reports" href={teacherHref('/finance/reports')} />
          </NavItem>
          
          {/* Automation */}
          <NavItem 
            label="Automation" 
            icon={<Zap className="w-5 h-5" />}
            sectionKey="automation"
          >
            <NavSubItem label="Lesson Reminders" href={teacherHref('/automation/lessons')} />
            <NavSubItem label="Homework Reminders" href={teacherHref('/automation/homework')} />
            <NavSubItem label="Payment Reminders" href={teacherHref('/automation/payments')} />
          </NavItem>
          
          <Separator className="my-3" />
          
          {/* Settings */}
          <NavItem 
            label="Settings" 
            icon={<Settings className="w-5 h-5" />}
            sectionKey="settings"
          >
            <NavSubItem label="Profile" href={teacherHref('/settings')} />
            <NavSubItem label="Notifications" href={teacherHref('/settings/notifications')} />
            <NavSubItem label="Calendar Sync" href={teacherHref('/settings/calendar')} />
            <NavSubItem label="Video & Classroom" href={teacherHref('/settings/video')} />
            <NavSubItem label="Payment Methods" href={teacherHref('/settings/payments')} />
            <NavSubItem label="Integrations" href={teacherHref('/settings/integrations')} />
            <NavSubItem label="Plan & Billing" href={teacherHref('/settings/billing')} />
          </NavItem>
          
          {/* Help */}
          <NavItem 
            label="Help" 
            icon={<HelpCircle className="w-5 h-5" />}
            sectionKey="help"
          >
            <NavSubItem label="Get Support" href={teacherHref('/help')} />
            <NavSubItem label="Documentation" href={teacherHref('/help/docs')} />
            <NavSubItem label="Keyboard Shortcuts" href={teacherHref('/help/shortcuts')} />
            <NavSubItem label="What's New" href={teacherHref('/help/changelog')} />
          </NavItem>
        </nav>
      </ScrollArea>

      <div
        className={`border-t border-sidebar-border ${sidebarCollapsed ? 'px-2' : 'px-3'} py-4`}
      >
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
