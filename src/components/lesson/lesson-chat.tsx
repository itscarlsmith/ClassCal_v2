'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Message } from '@/types/database'

interface LessonChatProps {
  lessonId: string
  className?: string
}

type LessonRow = {
  id: string
  teacher_id: string
  student_id: string | null
}

type StudentRow = {
  id: string
  user_id: string
  full_name: string
  avatar_url: string | null
}

type ProfileRow = {
  id: string
  full_name: string
  avatar_url: string | null
}

type ThreadRow = {
  id: string
}

type ThreadTarget =
  | {
      kind: 'student'
      otherProfileId: string
      label: string
      avatarUrl: string | null
    }
  | {
      kind: 'teacher'
      otherProfileId: string
      label: string
      avatarUrl: string | null
    }

type ThreadMeta = {
  threadId: string | null
  loading: boolean
  error: string | null
}

type ThreadChatMessage = Pick<Message, 'id' | 'sender_id' | 'recipient_id' | 'thread_id' | 'content' | 'created_at'> & {
  is_read?: boolean
}

function uniqStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0)))
}

function getErrorField(err: unknown, key: string): unknown {
  if (typeof err !== 'object' || err === null) return undefined
  const record = err as Record<string, unknown>
  return key in record ? record[key] : undefined
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-6 text-center text-sm text-muted-foreground">
        {message}
      </div>
    </div>
  )
}

function ThreadChatPanel({
  supabase,
  title,
  currentUserId,
  otherProfileId,
  threadId,
}: {
  supabase: ReturnType<typeof createClient>
  title: string
  currentUserId: string
  otherProfileId: string
  threadId: string | null
}) {
  const [messages, setMessages] = useState<ThreadChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const messageIdsRef = useRef<Set<string>>(new Set())

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const loadMessages = useCallback(async () => {
    if (!threadId) {
      setMessages([])
      messageIdsRef.current = new Set()
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('id, sender_id, recipient_id, thread_id, content, created_at, is_read')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      const normalized = (data || []) as ThreadChatMessage[]
      messageIdsRef.current = new Set(normalized.map((m) => m.id))
      setMessages(normalized)

      // Mark messages as read when viewing this thread (same behavior as Messages pages)
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('recipient_id', currentUserId)
        .eq('sender_id', otherProfileId)
        .eq('is_read', false)
    } catch (err) {
      console.error('Failed to load thread messages', err)
      setError('Could not load chat messages.')
    } finally {
      setLoading(false)
    }
  }, [threadId, supabase, currentUserId, otherProfileId])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!threadId) return

    const channel = supabase
      .channel(`thread-chat-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const newMessage = payload.new as ThreadChatMessage
          if (!newMessage?.id || messageIdsRef.current.has(newMessage.id)) return
          messageIdsRef.current.add(newMessage.id)
          setMessages((prev) => [...prev, newMessage])
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to thread chat channel')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, threadId])

  const handleSend = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!threadId || !input.trim()) return

      setSending(true)
      try {
        const { data: inserted, error: sendError } = await supabase
          .from('messages')
          .insert({
            sender_id: currentUserId,
            recipient_id: otherProfileId,
            thread_id: threadId,
            content: input.trim(),
          })
          .select('id, sender_id, recipient_id, thread_id, content, created_at, is_read')
          .single()

        if (sendError) throw sendError

        // Keep thread metadata fresh (same as Messages module)
        await supabase
          .from('message_threads')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', threadId)

        setInput('')

        // Optimistic append (realtime will also deliver; de-duped by id)
        if (inserted?.id && !messageIdsRef.current.has(inserted.id)) {
          messageIdsRef.current.add(inserted.id)
          setMessages((prev) => [...prev, inserted as ThreadChatMessage])
        }
      } catch (err) {
        console.error('Failed to send thread chat message', err)
        toast.error('Unable to send message.')
      } finally {
        setSending(false)
      }
    },
    [threadId, input, supabase, currentUserId, otherProfileId]
  )

  if (!threadId) {
    return <EmptyPanel title={title} message="No existing chat thread yet. Start a conversation in Messages first." />
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && messages.length === 0 && !loading && (
          <p className="text-center text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
        )}

        <div className="space-y-3">
          {messages.map((message) => {
            const isOwn = message.sender_id === currentUserId
            return (
              <div key={message.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[70%] rounded-2xl px-4 py-2 text-sm',
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted-foreground/15 text-foreground rounded-bl-md'
                  )}
                >
                  <p>{message.content}</p>
                  <p className={cn('mt-1 text-xs', isOwn ? 'text-primary-foreground/70' : 'text-foreground/60')}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
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

export function LessonChat({ lessonId, className }: LessonChatProps) {
  const supabase = useMemo(() => createClient(), [])

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [lesson, setLesson] = useState<LessonRow | null>(null)
  const [targets, setTargets] = useState<ThreadTarget[]>([])
  const [threadMetaByOther, setThreadMetaByOther] = useState<Record<string, ThreadMeta>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Bootstrap: auth uid + lesson participants (teacher vs student)
  useEffect(() => {
    let isMounted = true

    const bootstrap = async () => {
      if (!lessonId) return
      setLoading(true)
      setError(null)

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user?.id) {
          throw authError || new Error('Not authenticated')
        }

        if (!isMounted) return
        setCurrentUserId(user.id)

        const { data: lessonRow, error: lessonError } = await supabase
          .from('lessons')
          .select('id, teacher_id, student_id')
          .eq('id', lessonId)
          .single()

        if (lessonError) throw lessonError
        const normalizedLesson = lessonRow as LessonRow
        if (!isMounted) return
        setLesson(normalizedLesson)

        const isTeacher = normalizedLesson.teacher_id === user.id

        if (isTeacher) {
          // teacher: split chat by each student in the lesson
          const { data: extraStudents, error: extraStudentsError } = await supabase
            .from('lesson_students')
            .select('student_id')
            .eq('lesson_id', lessonId)
          const isLessonStudentsMissing =
            Boolean(extraStudentsError) &&
            (String(getErrorField(extraStudentsError, 'code')) === '42P01' ||
              String(getErrorField(extraStudentsError, 'message') || '')
                .toLowerCase()
                .includes('lesson_students') ||
              Number(getErrorField(extraStudentsError, 'status')) === 404)
          if (extraStudentsError && !isLessonStudentsMissing) throw extraStudentsError

          const participantStudentIds = uniqStrings([
            normalizedLesson.student_id,
            ...((!extraStudentsError && (extraStudents as Array<{ student_id: string }> | null)) || []).map(
              (row) => row.student_id
            ),
          ])

          if (participantStudentIds.length === 0) {
            setTargets([])
            return
          }

          const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('id, user_id, full_name, avatar_url')
            .in('id', participantStudentIds)

          if (studentsError) throw studentsError

          const mapped = (students || [])
            .filter((s): s is StudentRow => {
              const row = s as unknown as Record<string, unknown>
              return typeof row.user_id === 'string' && row.user_id.length > 0
            })
            .map((s) => s as StudentRow)
            .map<ThreadTarget>((s) => ({
              kind: 'student',
              otherProfileId: s.user_id,
              label: s.full_name || 'Student',
              avatarUrl: s.avatar_url ?? null,
            }))

          if (!isMounted) return
          setTargets(mapped)
        } else {
          // student: single chat with the teacher in this lesson
          const teacherId = normalizedLesson.teacher_id
          const { data: teacherProfile, error: teacherProfileError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', teacherId)
            .maybeSingle()

          if (teacherProfileError) throw teacherProfileError

          const teacher = teacherProfile as ProfileRow | null
          if (!isMounted) return
          setTargets([
            {
              kind: 'teacher',
              otherProfileId: teacherId,
              label: teacher?.full_name || 'Teacher',
              avatarUrl: teacher?.avatar_url ?? null,
            },
          ])
        }
      } catch (err) {
        console.error('Failed to bootstrap live lesson chat', err)
        const message = err instanceof Error ? err.message : 'Unable to load lesson chat.'
        if (isMounted) setError(message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void bootstrap()

    return () => {
      isMounted = false
    }
  }, [lessonId, supabase])

  // Resolve existing threads (no creation)
  useEffect(() => {
    let isMounted = true

    const resolveThreads = async () => {
      if (!currentUserId || !lesson || targets.length === 0) return

      // Teacher uses self as the teacher id; Student uses lesson.teacher_id.
      const isTeacher = lesson.teacher_id === currentUserId
      const teacherProfileId = isTeacher ? currentUserId : lesson.teacher_id
      const studentProfileId = isTeacher ? null : currentUserId

      setThreadMetaByOther((prev) => {
        const next = { ...prev }
        for (const t of targets) {
          next[t.otherProfileId] = { threadId: null, loading: true, error: null }
        }
        return next
      })

      try {
        const results = await Promise.all(
          targets.map(async (t) => {
            const otherId = t.otherProfileId
            const pair = isTeacher
              ? [teacherProfileId, otherId]
              : [teacherProfileId, studentProfileId].filter(Boolean)

            const { data: thread, error: threadError } = await supabase
              .from('message_threads')
              .select('id')
              .contains('participant_ids', pair as string[])
              .maybeSingle()

            if (threadError) {
              return { otherId, meta: { threadId: null, loading: false, error: threadError.message } }
            }

            return {
              otherId,
              meta: { threadId: (thread as ThreadRow | null)?.id ?? null, loading: false, error: null },
            }
          })
        )

        if (!isMounted) return
        setThreadMetaByOther((prev) => {
          const next = { ...prev }
          for (const r of results) next[r.otherId] = r.meta
          return next
        })
      } catch (err) {
        console.error('Failed to resolve message threads for lesson chat', err)
        if (!isMounted) return
        setThreadMetaByOther((prev) => {
          const next = { ...prev }
          for (const t of targets) {
            next[t.otherProfileId] = {
              threadId: null,
              loading: false,
              error: 'Unable to load message thread.',
            }
          }
          return next
        })
      }
    }

    void resolveThreads()

    return () => {
      isMounted = false
    }
  }, [currentUserId, lesson, targets, supabase])

  const isTeacherView = Boolean(currentUserId && lesson?.teacher_id === currentUserId)

  const content = useMemo(() => {
    if (error) {
      return <EmptyPanel title="Lesson Chat" message={error} />
    }

    if (loading) {
      return <EmptyPanel title="Lesson Chat" message="Loading…" />
    }

    if (!currentUserId || !lesson) {
      return <EmptyPanel title="Lesson Chat" message="Not ready yet." />
    }

    if (targets.length === 0) {
      return <EmptyPanel title="Lesson Chat" message="No participants found for this lesson." />
    }

    if (!isTeacherView) {
      const target = targets[0]
      const meta = threadMetaByOther[target.otherProfileId]
      if (meta?.error) {
        return <EmptyPanel title="Lesson Chat" message={meta.error} />
      }
      if (meta?.loading) {
        return <EmptyPanel title="Lesson Chat" message="Loading chat…" />
      }

      return (
        <ThreadChatPanel
          supabase={supabase}
          title={target.label}
          currentUserId={currentUserId}
          otherProfileId={target.otherProfileId}
          threadId={meta?.threadId ?? null}
        />
      )
    }

    // Teacher view: render one panel per student (split chat)
    const panels = targets.map((t) => {
      const meta = threadMetaByOther[t.otherProfileId]
      const title = t.label

      if (meta?.error) {
        return <EmptyPanel key={t.otherProfileId} title={title} message={meta.error} />
      }

      if (meta?.loading) {
        return <EmptyPanel key={t.otherProfileId} title={title} message="Loading chat…" />
      }

      return (
        <ThreadChatPanel
          key={t.otherProfileId}
          supabase={supabase}
          title={title}
          currentUserId={currentUserId}
          otherProfileId={t.otherProfileId}
          threadId={meta?.threadId ?? null}
        />
      )
    })

    // If there are 2 students, show a clear split; otherwise stack.
    const splitClass =
      panels.length === 2 ? 'grid grid-rows-2 gap-4' : 'flex flex-col gap-4 overflow-hidden'

    return <div className={cn('h-full', splitClass)}>{panels}</div>
  }, [error, loading, currentUserId, lesson, targets, isTeacherView, threadMetaByOther, supabase])

  return <div className={cn('h-full min-h-[320px]', className)}>{content}</div>
}

