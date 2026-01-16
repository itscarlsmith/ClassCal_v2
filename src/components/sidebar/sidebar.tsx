'use client'

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
  CalendarDays,
  CalendarCheck,
  CalendarClock,
  RefreshCw,
  Video,
  FileText,
  ClipboardList,
  UserPlus,
  TrendingUp,
  CreditCard,
  Inbox,
  Users2,
  FolderPlus,
  FileQuestion,
  Layers,
  Receipt,
  Wallet,
  Package,
  ArrowRightLeft,
  BarChart3,
  Bell,
  User,
  Link2,
  Keyboard,
  Sparkles,
  LifeBuoy,
  BookOpenCheck,
  Clock
} from 'lucide-react'
import { NavItem, NavSubItem } from './nav-item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ClassCal Logo Component
function ClassCalLogo() {
  return (
    <div className="flex items-center gap-3 px-3 py-4">
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
      <span className="text-lg font-semibold tracking-tight">ClassCal</span>
    </div>
  )
}

export function Sidebar() {
  const teacherHref = (path: string) => `/teacher${path}`

  return (
    <aside className="w-64 h-screen flex flex-col border-r border-sidebar-border bg-sidebar">
      <ClassCalLogo />

      <ScrollArea className="flex-1 min-h-0 px-3">
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
            badge={2}
          >
            <NavSubItem label="All Assignments" href={teacherHref('/homework')} />
            <NavSubItem label="To Review" href={teacherHref('/homework/review')} badge={2} />
            <NavSubItem label="Submitted" href={teacherHref('/homework/submitted')} />
            <NavSubItem label="Overdue" href={teacherHref('/homework/overdue')} />
            <NavSubItem label="Templates" href={teacherHref('/homework/templates')} />
          </NavItem>
          
          {/* Messages */}
          <NavItem 
            label="Messages" 
            icon={<MessageSquare className="w-5 h-5" />}
            sectionKey="messages"
            badge={3}
          >
            <NavSubItem label="Inbox" href={teacherHref('/messages')} badge={3} />
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
    </aside>
  )
}

