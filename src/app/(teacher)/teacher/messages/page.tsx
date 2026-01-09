'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import type { Message, Student, Profile } from '@/types/database'

type ThreadWithMessages = {
  id: string
  participant: Pick<Student, 'id' | 'full_name' | 'avatar_url' | 'email'>
  lastMessage: Message | null
  unreadCount: number
}

export default function MessagesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
  })

  // Fetch students for thread list (teacher sees students)
  const { data: students } = useQuery({
    queryKey: ['students-for-messages'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, avatar_url, email, user_id')
        .eq('teacher_id', userData.user?.id)
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  const selectedStudent = useMemo(
    () => students?.find((s) => s.id === selectedThread) ?? null,
    [students, selectedThread]
  )

  const teacherId = currentUser?.id ?? null
  const studentProfileId = selectedStudent?.user_id ?? null

  // Fetch messages for selected thread
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['teacher-messages', teacherId, studentProfileId],
    enabled: Boolean(teacherId && studentProfileId),
    queryFn: async () => {
      if (!teacherId || !studentProfileId) return []

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${teacherId},recipient_id.eq.${studentProfileId}),and(sender_id.eq.${studentProfileId},recipient_id.eq.${teacherId})`
        )
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Message[]
    },
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedStudent?.user_id || !teacherId) {
        throw new Error('Missing participant information')
      }

      // Get or create thread
      let threadId: string
      const { data: existingThread } = await supabase
        .from('message_threads')
        .select('id')
        .contains('participant_ids', [teacherId, selectedStudent.user_id])
        .single()

      if (existingThread) {
        threadId = existingThread.id
      } else {
        const { data: newThread, error: threadError } = await supabase
          .from('message_threads')
          .insert({
            participant_ids: [teacherId, selectedStudent.user_id],
          })
          .select()
          .single()
        if (threadError) throw threadError
        threadId = newThread.id
      }

      // Send message
      const { error } = await supabase.from('messages').insert({
        sender_id: teacherId,
        recipient_id: selectedStudent.user_id,
        thread_id: threadId,
        content,
      })
      if (error) throw error

      // Update thread last_message_at
      await supabase
        .from('message_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teacher-messages', teacherId, studentProfileId],
      })
      setMessageText('')
    },
    onError: (error) => {
      toast.error('Failed to send message')
      console.error(error)
    },
  })

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages as read when opening a conversation (teacher as recipient)
  useEffect(() => {
    const markRead = async () => {
      if (!teacherId || !studentProfileId) return
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('recipient_id', teacherId)
        .eq('sender_id', studentProfileId)
        .eq('is_read', false)
    }
    markRead()
  }, [teacherId, studentProfileId, supabase])

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatMessageTime = (date: string) => {
    const d = new Date(date)
    if (isToday(d)) return format(d, 'h:mm a')
    if (isYesterday(d)) return 'Yesterday'
    return format(d, 'MMM d')
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim()) return
    sendMessageMutation.mutate(messageText)
  }

  const filteredStudents = students?.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full flex">
      {/* Thread List */}
      <div className="w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredStudents?.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedThread(student.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left',
                  selectedThread === student.id && 'bg-muted'
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={student.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(student.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{student.full_name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {student.email}
                  </p>
                </div>
              </button>
            ))}

            {filteredStudents?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No conversations found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col">
        {selectedThread && selectedStudent ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedStudent.avatar_url || undefined} />
                <AvatarFallback>{getInitials(selectedStudent.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{selectedStudent.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages?.map((message) => {
                  const isOwn = message.sender_id === currentUser?.id
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        isOwn ? 'justify-end' : 'justify-start'
                      )}
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
                          {format(new Date(message.created_at), 'h:mm a')}
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

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-card">
              <div className="flex gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" disabled={!messageText.trim() || sendMessageMutation.isPending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a student to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

