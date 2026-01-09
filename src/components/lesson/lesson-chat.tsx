'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import type { Message, Profile } from '@/types/database'

interface LessonChatProps {
  lessonId: string
  className?: string
}

type LessonChatMessage = Message & {
  sender?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

export function LessonChat({ lessonId, className }: LessonChatProps) {
  const supabase = useMemo(() => createClient(), [])
  const currentUser = useAppStore((state) => state.user)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LessonChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const profileCacheRef = useRef<Record<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>>({})
  const messageIdsRef = useRef<Set<string>>(new Set())

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const fetchSenderProfile = useCallback(
    async (profileId: string) => {
      if (profileCacheRef.current[profileId]) {
        return profileCacheRef.current[profileId]
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', profileId)
        .maybeSingle()

      if (data) {
        profileCacheRef.current[profileId] = data
        return data
      }

      return null
    },
    [supabase]
  )

  const loadMessages = useCallback(
    async (targetLessonId: string) => {
      const { data, error: messageError } = await supabase
        .from('messages')
        .select('*, sender:profiles(id, full_name, avatar_url)')
        .eq('lesson_id', targetLessonId)
        .order('created_at', { ascending: true })

      if (messageError) {
        console.error('Failed to load lesson messages', messageError)
        throw new Error('Could not load chat messages.')
      }

      const normalized = (data || []).map((msg) => {
        const sender = (msg as LessonChatMessage).sender ?? null
        if (sender?.id) {
          profileCacheRef.current[sender.id] = sender
        }
        return {
          ...(msg as Message),
          sender,
        }
      })

      messageIdsRef.current = new Set(normalized.map((msg) => msg.id))
      setMessages(normalized)
    },
    [supabase]
  )

  useEffect(() => {
    let isMounted = true
    const bootstrap = async () => {
      if (!lessonId) return
      setLoading(true)
      setError(null)

      try {
        const { data: existingThread, error: threadError } = await supabase
          .from('message_threads')
          .select('id')
          .eq('lesson_id', lessonId)
          .maybeSingle()

        if (threadError) {
          console.error('Unable to load lesson chat thread', threadError)
          const rawMessage =
            (threadError as any)?.message ||
            (threadError as any)?.details ||
            'Unable to load lesson chat thread.'
          const migrationHint =
            String(rawMessage).toLowerCase().includes('lesson_id') &&
            String(rawMessage).toLowerCase().includes('column')
              ? ' Database migrations may not be applied yet (missing lesson chat columns).'
              : ''
          throw new Error(`${rawMessage}${migrationHint}`)
        }

        let resolvedThreadId = existingThread?.id ?? null

        if (!resolvedThreadId) {
          const { data: lesson, error: lessonError } = await supabase
            .from('lessons')
            .select('teacher_id')
            .eq('id', lessonId)
            .single()
          if (lessonError) {
            console.error('Unable to load lesson for chat bootstrap', lessonError)
            throw new Error((lessonError as any)?.message || 'Unable to load lesson for chat.')
          }

          const participantIds =
            [lesson?.teacher_id, currentUser?.id].filter(
              (value): value is string => typeof value === 'string' && value.length > 0
            )

          const { data: newThread, error: insertError } = await supabase
            .from('message_threads')
            .insert({
              participant_ids: participantIds,
              lesson_id: lessonId,
            })
            .select('id')
            .single()

          if (insertError || !newThread) {
            console.error('Failed to create lesson chat thread', insertError)
            const rawMessage =
              (insertError as any)?.message ||
              (insertError as any)?.details ||
              'Unable to create chat thread.'
            throw new Error(rawMessage)
          }

          resolvedThreadId = newThread.id
        }

        if (!isMounted) return

        setThreadId(resolvedThreadId)
        await loadMessages(lessonId)
      } catch (err) {
        console.error(err)
        if (isMounted) {
          const friendly = err instanceof Error ? err.message : 'Unable to load lesson chat.'
          setError(friendly)
          toast.error(friendly)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      isMounted = false
    }
  }, [lessonId, loadMessages, supabase, currentUser?.id])

  useEffect(() => {
    if (!lessonId) return

    const channel = supabase
      .channel(`lesson-chat-${lessonId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `lesson_id=eq.${lessonId}` },
        async (payload) => {
          const newMessage = payload.new as Message
          if (messageIdsRef.current.has(newMessage.id)) {
            return
          }

          messageIdsRef.current.add(newMessage.id)
          const sender = await fetchSenderProfile(newMessage.sender_id)
          setMessages((prev) => [...prev, { ...newMessage, sender }])
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to lesson chat channel')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [lessonId, supabase, fetchSenderProfile])

  const handleSend = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!input.trim() || !threadId || !currentUser?.id) return

      setSending(true)
      try {
        const { error: sendError } = await supabase.from('messages').insert({
          content: input.trim(),
          sender_id: currentUser.id,
          thread_id: threadId,
          lesson_id: lessonId,
        })

        if (sendError) {
          throw sendError
        }

        setInput('')
      } catch (err) {
        console.error('Failed to send lesson chat message', err)
        toast.error('Unable to send message.')
      } finally {
        setSending(false)
      }
    },
    [input, threadId, currentUser?.id, supabase, lessonId]
  )

  return (
    <div className={cn('flex h-full min-h-[320px] flex-col rounded-xl border border-border bg-card', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Lesson Chat</p>
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && messages.length === 0 && !loading && (
          <p className="text-center text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
        )}

        {messages.map((message) => {
          const isOwn = message.sender_id === currentUser?.id
          return (
            <div key={message.id} className={cn('flex flex-col text-sm', isOwn ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-2',
                  isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'
                )}
              >
                {!isOwn && (
                  <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground/80">
                    {message.sender?.full_name || 'Participant'}
                  </p>
                )}
                <p>{message.content}</p>
              </div>
              <span className="mt-1 text-xs text-muted-foreground">
                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-border p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your message…"
            disabled={!threadId || sending}
          />
          <Button type="submit" disabled={!input.trim() || !threadId || sending}>
            Send
          </Button>
        </div>
      </form>
    </div>
  )
}

