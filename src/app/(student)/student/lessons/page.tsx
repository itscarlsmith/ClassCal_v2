'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format, isAfter } from 'date-fns'
import Link from 'next/link'
import { Calendar, Clock } from 'lucide-react'
import type { Lesson } from '@/types/database'
import { isJoinWindowOpen } from '@/lib/lesson-join'
import { useNow } from '@/lib/lesson-join-client'
import { useRouter } from 'next/navigation'

type LessonWithTeacher = Lesson & {
  teacher: {
    id: string
    full_name: string
    avatar_url: string | null
    email: string | null
  } | null
}

const statusClass = {
  pending: 'badge-pending',
  confirmed: 'badge-confirmed',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
}

export default function StudentLessonsPage() {
  const supabase = createClient()
  const { openDrawer } = useAppStore()
  const router = useRouter()

  const { data: studentRows, isLoading: isStudentsLoading, error: studentError } = useQuery({
    queryKey: ['student-account'],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) throw userError || new Error('Not authenticated')
      const { data, error } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userData.user.id)
      if (error) throw error
      return data || []
    },
  })

  const studentIds = useMemo(() => studentRows?.map((row) => row.id) || [], [studentRows])

  const { data: lessons, isLoading: isLessonsLoading } = useQuery({
    queryKey: ['student-lessons', studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const [primary, group] = await Promise.all([
        supabase
          .from('lessons')
          .select('*, teacher:profiles(id, full_name, avatar_url, email)')
          .in('student_id', studentIds)
          .order('start_time', { ascending: true }),
        supabase
          .from('lessons')
          .select('*, teacher:profiles(id, full_name, avatar_url, email), lesson_students!inner(student_id)')
          .in('lesson_students.student_id', studentIds)
          .order('start_time', { ascending: true }),
      ])

      if (primary.error) throw primary.error
      if (group.error) throw group.error

      const combined = [
        ...((primary.data || []) as LessonWithTeacher[]),
        ...((group.data || []) as LessonWithTeacher[]),
      ]
      const deduped = Array.from(new Map(combined.map((l) => [l.id, l])).values())
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      return deduped
    },
  })

  const now = new Date()
  const upcomingLessons = useMemo(
    () =>
      lessons
        ?.filter(
          (lesson) =>
            new Date(lesson.start_time) >= now &&
            (lesson.status === 'pending' || lesson.status === 'confirmed')
        )
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) || [],
    [lessons, now]
  )

  const pastLessons = useMemo(
    () =>
      lessons
        ?.filter((lesson) => new Date(lesson.start_time) < now)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()) || [],
    [lessons, now]
  )

  const liveNow = useNow(30_000)

  const renderLessonRow = (lesson: LessonWithTeacher) => {
    const start = new Date(lesson.start_time)
    const end = new Date(lesson.end_time)
    const joinVisible =
      lesson.status === 'confirmed' &&
      isJoinWindowOpen({ startTime: lesson.start_time, endTime: lesson.end_time, now: liveNow })
    return (
      <div
        key={lesson.id}
        className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 hover:border-primary transition-colors"
      >
        <div className="min-w-[120px] text-sm font-semibold">
          {format(start, 'MMM d, yyyy')}
        </div>
        <div className="min-w-[160px] text-sm text-muted-foreground">
          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
        </div>
        <div className="flex-1 flex items-center gap-3 min-w-[180px]">
          <Avatar className="h-10 w-10">
            <AvatarImage src={lesson.teacher?.avatar_url || undefined} />
            <AvatarFallback>
              {lesson.teacher?.full_name
                ?.split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'T'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium truncate">
              {lesson.teacher?.full_name || 'Your teacher'}
            </p>
            {lesson.teacher?.email && (
              <p className="text-xs text-muted-foreground truncate">
                {lesson.teacher.email}
              </p>
            )}
          </div>
        </div>
        <Badge className={statusClass[lesson.status] || 'badge-pending'}>
          {lesson.status}
        </Badge>
        <div className="flex gap-2">
          {joinVisible && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/student/lessons/${lesson.id}/call`)}
            >
              Join
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDrawer('student-lesson', lesson.id)}
          >
            View
          </Button>
        </div>
      </div>
    )
  }

  const renderLessonsTab = (list: LessonWithTeacher[], emptyCopy: React.ReactNode) => {
    if (isLessonsLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )
    }

    if (!list.length) {
      return (
        <div className="text-center py-12 space-y-3 text-muted-foreground">
          {emptyCopy}
        </div>
      )
    }

    return <div className="space-y-3">{list.map(renderLessonRow)}</div>
  }

  return (
    <section className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lessons</h1>
          <p className="text-muted-foreground mt-1">
            Review your upcoming and past lessons.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">
                Upcoming ({upcomingLessons.length})
              </TabsTrigger>
              <TabsTrigger value="past">
                Past ({pastLessons.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">{renderLessonsTab(
              upcomingLessons,
              <>
                <Calendar className="mx-auto text-accent mb-2 h-10 w-10" />
                <p className="text-lg font-semibold">No upcoming lessons yet.</p>
                <p>You don’t have any upcoming lessons yet. Visit the Calendar to book one.</p>
                <Link href="/student/calendar">
                  <Button className="mt-4">Open Calendar</Button>
                </Link>
              </>
            )}</TabsContent>

            <TabsContent value="past">{renderLessonsTab(
              pastLessons,
              <>
                <Clock className="mx-auto text-accent mb-2 h-10 w-10" />
                <p className="text-lg font-semibold">No past lessons yet.</p>
                <p>No past lessons yet. Once you complete lessons, they’ll appear here.</p>
              </>
            )}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  )
}



