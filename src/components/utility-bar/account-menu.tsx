'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface AccountMenuProps {
  role: 'teacher' | 'student'
  user: Profile | null
}

function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim().length > 0) {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
}

export function AccountMenu({ role, user }: AccountMenuProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const baseSettingsPath = role === 'teacher' ? '/teacher/settings' : '/student/settings'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatar_url || undefined} alt={user?.full_name ?? 'User'} />
            <AvatarFallback>{getInitials(user?.full_name, user?.email)}</AvatarFallback>
          </Avatar>
          <span className="sr-only">Account</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => router.push(`${baseSettingsPath}?tab=profile`)}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`${baseSettingsPath}?tab=notifications`)}>
          Notification settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`${baseSettingsPath}?tab=calendar-sync`)}>
          Calendar sync
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
