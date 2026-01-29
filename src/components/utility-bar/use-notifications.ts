'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types/database'

export function useNotificationsList(userId: string | null) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [] as Notification[]
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data ?? []) as Notification[]
    },
    enabled: Boolean(userId),
  })
}

export function useUnreadNotificationsCount(userId: string | null) {
  return useQuery({
    queryKey: ['notifications-unread-count', userId],
    queryFn: async () => {
      if (!userId) return 0
      const supabase = createClient()
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) throw error
      return count ?? 0
    },
    enabled: Boolean(userId),
  })
}

export function useMarkNotificationRead(userId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', userId] })
    },
  })
}
