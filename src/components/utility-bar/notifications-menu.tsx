'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { getNotificationHref } from './notification-routing'
import { useMarkNotificationRead, useNotificationsList, useUnreadNotificationsCount } from './use-notifications'
import type { Notification } from '@/types/database'

interface NotificationsMenuProps {
  role: 'teacher' | 'student'
  userId: string | null
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function sortNotifications(items: Notification[]) {
  return [...items].sort((a, b) => {
    const priorityA = a.priority ?? 0
    const priorityB = b.priority ?? 0
    const priorityDiff = priorityB - priorityA
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function NotificationsMenu({ role, userId }: NotificationsMenuProps) {
  const router = useRouter()
  const { data: notifications = [] } = useNotificationsList(userId)
  const { data: unreadCount = 0 } = useUnreadNotificationsCount(userId)
  const markRead = useMarkNotificationRead(userId)

  const visibleNotifications = useMemo(() => {
    const filtered = notifications.filter((notification) => {
      if (notification.role) return notification.role === role
      return true
    })
    return sortNotifications(filtered)
  }, [notifications, role])

  const handleSelect = (notification: Notification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id)
    }
    router.push(getNotificationHref(notification, role))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -top-1 -right-1 min-w-[18px] rounded-full bg-primary px-1 text-[10px] font-semibold leading-[18px] text-primary-foreground text-center'
              )}
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visibleNotifications.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">
            You&apos;re all caught up 🎉
          </div>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            {visibleNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={() => handleSelect(notification)}
                className={cn(
                  'flex flex-col items-start gap-1 py-3',
                  !notification.is_read && 'bg-muted/50'
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {notification.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(notification.created_at)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {notification.message}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
