import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  BookOpenCheck,
  Coins,
  MessageSquare,
  ArrowRight,
} from 'lucide-react'
import { format, isToday, isTomorrow } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Lesson, Profile, Student } from '@/types/database'
import { isJoinWindowOpen } from '@/lib/lesson-join'

function getRelativeDay(date: Date) {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEEE')
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default async function StudentDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <section className="p-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Student Dashboard</h1>
        <p className="text-muted-foreground">Please sign in to view your dashboard.</p>
      </section>
    )
  }

  const [
    { data: profileData, error: profileError },
    { data: studentRows, error: studentError },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase
      .from('students')
      .select('id, teacher_id, full_name, email, avatar_url, credits')
      .eq('user_id', user.id),
  ])

  const profile: Pick<Profile, 'full_name'> | null = profileError ? null : profileData

  const students: (Pick<
    Student,
    'id' | 'teacher_id' | 'full_name' | 'email' | 'avatar_url' | 'credits'
  >)[] = studentError ? [] : studentRows || []

  const studentIds = students.map((s) => s.id)
  const teacherIds = Array.from(new Set(students.map((s) => s.teacher_id).filter(Boolean)))

  const creditsRemaining = students.reduce((sum, s) => sum + (s.credits || 0), 0)

  const { data: teacherProfilesRows, error: teacherProfilesError } = teacherIds.length
    ? await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', teacherIds)
    : { data: [] as Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>[], error: null }

  if (teacherProfilesError) {
    console.error('Error loading teacher profiles', teacherProfilesError)
  }

  const teacherProfiles =
    teacherProfilesError || !teacherProfilesRows ? [] : teacherProfilesRows

  const teacherById = new Map<string, Pick<Profile, 'full_name' | 'email' | 'avatar_url'>>()
  teacherProfiles.forEach((t) => teacherById.set(t.id, t))

  const nowIso = new Date().toISOString()

  let nextLesson: Lesson | null = null
  if (studentIds.length > 0) {
    const { data: nextRows, error: nextError } = await supabase
      .from('lessons')
      .select('*')
      .in('student_id', studentIds)
      .eq('status', 'confirmed')
      .gt('start_time', nowIso)
      .order('start_time', { ascending: true })
      .limit(5)

    if (nextError) {
      console.error('Error loading next lesson', nextError)
    } else if (nextRows && nextRows.length > 0) {
      nextLesson = (nextRows as Lesson[]).sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )[0]
    }
  }

  let upcomingLessons: Lesson[] = []
  if (studentIds.length > 0) {
    const { data: upcomingRows, error: upcomingError } = await supabase
      .from('lessons')
      .select('*')
      .in('student_id', studentIds)
      .in('status', ['pending', 'confirmed'])
      .gte('start_time', nowIso)
      .order('start_time', { ascending: true })
      .limit(10)

    if (upcomingError) {
      console.error('Error loading upcoming lessons', upcomingError)
    } else {
      upcomingLessons = ((upcomingRows || []) as Lesson[])
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5)
    }
  }

  const { count: homeworkDueCount = 0, error: homeworkError } =
    studentIds.length > 0
      ? await supabase
          .from('homework')
          .select('*', { count: 'exact', head: true })
          .in('student_id', studentIds)
          .in('status', ['assigned', 'needs_revision', 'overdue'])
      : { count: 0, error: null }

  if (homeworkError) {
    console.error('Error counting homework', homeworkError)
  }

  const { count: unreadMessagesCount = 0, error: messagesError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .eq('is_read', false)

  if (messagesError) {
    console.error('Error counting messages', messagesError)
  }

  const greetingName =
    profile?.full_name?.split(' ')[0] || 'Student'

  const nextLessonDate = nextLesson ? new Date(nextLesson.start_time) : null
  const nextLessonTeacherName = nextLesson
    ? teacherById.get(nextLesson.teacher_id)?.full_name || ''
    : ''
  const nextLessonJoinVisible =
    !!nextLesson &&
    nextLesson.status === 'confirmed' &&
    isJoinWindowOpen({ startTime: nextLesson.start_time, endTime: nextLesson.end_time })

  return (
    <section className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {greetingName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s a quick overview of your learning
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/student/calendar">
            <Button variant="default">Book Lesson</Button>
          </Link>
          <Link href="/student/calendar">
            <Button variant="outline">Open Calendar</Button>
          </Link>
          <Link href="/student/homework">
            <Button variant="outline">View Homework</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Next Lesson</p>
                {nextLessonDate ? (
                  <>
                    <p className="stat-value mt-2">
                      {getRelativeDay(nextLessonDate)} at {format(nextLessonDate, 'h:mm a')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {nextLessonTeacherName ? `with ${nextLessonTeacherName}` : 'Upcoming session'}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground mt-2">No upcoming lessons</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Link
                href="/student/calendar"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                View calendar
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
              {nextLessonJoinVisible && nextLesson && (
                <Link className="ml-auto" href={`/student/lessons/${nextLesson.id}/call`}>
                  <Button size="sm">Join Lesson</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Homework Due</p>
                <p className="stat-value mt-2">{homeworkDueCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <BookOpenCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <Link
              href="/student/homework"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mt-4"
            >
              View homework
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Credits Remaining</p>
                <p className="stat-value mt-2">{creditsRemaining}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use credits to book lessons
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Coins className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <Link
              href="/student/calendar"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mt-4"
            >
              Book a lesson
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unread Messages</p>
                <p className="stat-value mt-2">{unreadMessagesCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <Link
              href="/student/messages"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mt-4"
            >
              View messages
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold">Upcoming Lessons</CardTitle>
            <Link href="/student/lessons">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingLessons.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingLessons.map((lesson) => {
                    const start = new Date(lesson.start_time)
                    const end = new Date(lesson.end_time)
                    const teacherName = teacherById.get(lesson.teacher_id)?.full_name

                    const statusClass =
                      lesson.status === 'confirmed'
                        ? 'badge-confirmed'
                        : lesson.status === 'pending'
                        ? 'badge-pending'
                        : 'badge-secondary'

                    return (
                      <TableRow key={lesson.id}>
                        <TableCell>{format(start, 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                        </TableCell>
                        <TableCell>{teacherName || 'Your teacher'}</TableCell>
                        <TableCell>
                          <Badge className={statusClass}>{lesson.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href="/student/lessons">
                            <Button size="sm" variant="outline">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No upcoming lessons yet.</p>
                <p className="text-sm text-muted-foreground">
                  New lessons will appear here once scheduled.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Your Teachers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {teacherProfiles.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                Your teachers will appear here once your account is connected to a teacher.
              </div>
            ) : (
              teacherProfiles.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/40"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={teacher.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(teacher.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{teacher.full_name}</p>
                    {teacher.email && (
                      <p className="text-sm text-muted-foreground truncate">{teacher.email}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/student/calendar?teacher=${teacher.id}`}>
                      <Button size="sm" variant="outline">
                        Book Lesson
                      </Button>
                    </Link>
                    <Link href={`/student/messages?teacher=${teacher.id}`}>
                      <Button size="sm" variant="ghost">
                        Message
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

