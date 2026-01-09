'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Search, MessageSquare } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'

type TeacherContact = {
  teacherId: string
  full_name: string
  avatar_url: string | null
  email: string | null
}

type MessageRow = {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: string
}

export default function StudentMessagesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: currentUser } = useQuery({
    queryKey: ['student-current-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })

  const { data: teacherContacts } = useQuery({
    queryKey: ['student-teacher-contacts'],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) throw userError || new Error('Not authenticated')
      const { data, error } = await supabase
        .from('students')
        .select(
          'teacher_id, teacher:profiles!students_teacher_id_fkey(id, full_name, avatar_url, email)'
        )
        .eq('user_id', userData.user.id)
      if (error) throw error
      const unique = new Map<string, TeacherContact>()
      ;(data || []).forEach((row) => {
        if (!row.teacher_id || unique.has(row.teacher_id)) return
        const teacher = (row as any).teacher
        const teacherProfile =
          Array.isArray(teacher) ? (teacher[0] as any) : (teacher as any)
        unique.set(row.teacher_id, {
          teacherId: row.teacher_id,
          full_name: teacherProfile?.full_name || 'Teacher',
          avatar_url: teacherProfile?.avatar_url || null,
          email: teacherProfile?.email || null,
        })
      })
      return Array.from(unique.values())
    },
  })

  const studentProfileId = currentUser?.id ?? null
  const teacherProfileId = selectedTeacher ?? null

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['student-messages', studentProfileId, teacherProfileId],
    enabled: Boolean(studentProfileId && teacherProfileId),
    queryFn: async () => {
      if (!studentProfileId || !teacherProfileId) return []

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${studentProfileId},recipient_id.eq.${teacherProfileId}),and(sender_id.eq.${teacherProfileId},recipient_id.eq.${studentProfileId})`
        )
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []) as MessageRow[]
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const markRead = async () => {
      if (!selectedTeacher || !currentUser?.id) return
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('recipient_id', currentUser.id)
        .eq('sender_id', selectedTeacher)
        .eq('is_read', false)
    }
    markRead()
  }, [selectedTeacher, currentUser, supabase])

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!teacherProfileId || !studentProfileId || !messageText.trim()) {
        throw new Error('Missing participant information')
      }

      let threadId: string | null = null
      const { data: existingThread } = await supabase
        .from('message_threads')
        .select('id')
        .contains('participant_ids', [studentProfileId, teacherProfileId])
        .single()

      if (existingThread) {
        threadId = existingThread.id
      } else {
        const { data: newThread, error: threadError } = await supabase
          .from('message_threads')
          .insert({
            participant_ids: [studentProfileId, teacherProfileId],
          })
          .select()
          .single()
        if (threadError) throw threadError
        threadId = newThread.id
      }

      const { error } = await supabase.from('messages').insert({
        sender_id: studentProfileId,
        recipient_id: teacherProfileId,
        thread_id: threadId,
        content: messageText.trim(),
      })
      if (error) throw error

      await supabase
        .from('message_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId)
    },
    onSuccess: () => {
      setMessageText('')
      queryClient.invalidateQueries({
        queryKey: ['student-messages', studentProfileId, teacherProfileId],
      })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to send message'
      toast.error(message)
    },
  })

  const filteredContacts = useMemo(() => {
    const list = teacherContacts || []
    if (!searchQuery) return list
    return list.filter(
      (t) =>
        t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [teacherContacts, searchQuery])

  // Preselect teacher if provided in query params
  useEffect(() => {
    const teacherParam = searchParams.get('teacher')
    if (teacherParam && teacherContacts?.some((t) => t.teacherId === teacherParam)) {
      setSelectedTeacher(teacherParam)
    }
    if (!teacherParam && !selectedTeacher && teacherContacts && teacherContacts.length === 1) {
      setSelectedTeacher(teacherContacts[0].teacherId)
    }
  }, [searchParams, teacherContacts, selectedTeacher])

  const formatMessageTime = (date: string) => {
    const d = new Date(date)
    if (isToday(d)) return format(d, 'h:mm a')
    if (isYesterday(d)) return 'Yesterday'
    return format(d, 'MMM d')
  }

  const selectedTeacherContact = teacherContacts?.find((t) => t.teacherId === selectedTeacher)

  return (
    <div className="h-full flex">
      <div className="w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredContacts.map((teacher) => (
              <button
                key={teacher.teacherId}
                onClick={() => setSelectedTeacher(teacher.teacherId)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left',
                  selectedTeacher === teacher.teacherId && 'bg-muted'
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={teacher.avatar_url || undefined} />
                  <AvatarFallback>
                    {teacher.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{teacher.full_name}</p>
                  <p className="text-sm text-muted-foreground truncate">{teacher.email}</p>
                </div>
              </button>
            ))}

            {filteredContacts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No teachers linked yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedTeacher && selectedTeacherContact ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedTeacherContact.avatar_url || undefined} />
                <AvatarFallback>
                  {selectedTeacherContact.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{selectedTeacherContact.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedTeacherContact.email}</p>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages?.map((message) => {
                  const isOwn = message.sender_id === currentUser?.id
                  return (
                    <div
                      key={message.id}
                      className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2',
                          isOwn
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted-foreground/15 text-foreground rounded-bl-md'
                        )}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p
                          className={cn(
                            'text-xs mt-1',
                            isOwn ? 'text-primary-foreground/70' : 'text-foreground/60'
                          )}
                        >
                          {formatMessageTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}

                {(!messages || messages.length === 0) && !messagesLoading && (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm">Send a message to start the conversation</p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage.mutate()
              }}
              className="p-4 border-t border-border bg-card"
            >
              <div className="flex gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" disabled={!messageText.trim() || sendMessage.isPending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a teacher</p>
              <p className="text-sm">Choose a teacher to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
