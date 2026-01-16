'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Calendar, Clock, Video, FileText } from 'lucide-react'
import { format, isPast, isFuture, isToday } from 'date-fns'
import type { Lesson, Student } from '@/types/database'

type LessonWithStudent = Lesson & { student: Pick<Student, 'id' | 'full_name' | 'avatar_url' | 'email'> }

export default function LessonsPage() {
  const { openDrawer } = useAppStore()
  const supabase = createClient()

  // Fetch lessons
  const { data: lessons, isLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('lessons')
        .select('*, student:students(id, full_name, avatar_url, email)')
        .eq('teacher_id', userData.user?.id)
        .order('start_time', { ascending: true })
      if (error) throw error
      return data as LessonWithStudent[]
    },
  })

  const upcomingLessons = lessons?.filter((l) => isFuture(new Date(l.start_time)) || isToday(new Date(l.start_time)))
  const pastLessons = lessons?.filter((l) => isPast(new Date(l.end_time)))?.reverse()

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed': return 'badge-completed'
      case 'confirmed': return 'badge-confirmed'
      case 'cancelled': return 'badge-cancelled'
      default: return 'badge-pending'
    }
  }

  const LessonCard = ({ lesson }: { lesson: LessonWithStudent }) => {
    const lessonDate = new Date(lesson.start_time)
    const endTime = new Date(lesson.end_time)
    
    return (
      <div
        className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
        onClick={() => openDrawer('lesson', lesson.id)}
      >
        <Avatar className="h-12 w-12">
          <AvatarImage src={lesson.student?.avatar_url || undefined} />
          <AvatarFallback>{getInitials(lesson.student?.full_name || 'S')}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{lesson.title}</h3>
            <Badge className={getStatusBadgeClass(lesson.status)}>
              {lesson.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            with {lesson.student?.full_name}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium">{format(lessonDate, 'MMM d, yyyy')}</p>
          <p className="text-sm text-muted-foreground">
            {format(lessonDate, 'h:mm a')} - {format(endTime, 'h:mm a')}
          </p>
        </div>
        <div className="flex gap-2">
          {lesson.meeting_url && (
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                window.open(lesson.meeting_url!, '_blank')
              }}
            >
              <Video className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              openDrawer('lesson', lesson.id)
            }}
          >
            <FileText className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lessons</h1>
          <p className="text-muted-foreground mt-1">
            View and manage your teaching sessions
          </p>
        </div>
        <Button onClick={() => openDrawer('lesson', 'new')}>
          <Plus className="w-4 h-4 mr-2" />
          Schedule Lesson
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold">{upcomingLessons?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-2xl font-bold">
                {lessons?.filter((l) => isToday(new Date(l.start_time))).length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <span className="text-lg font-bold text-amber-600">⏳</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">
                {lessons?.filter((l) => l.status === 'pending').length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <span className="text-lg font-bold text-purple-600">✓</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">
                {lessons?.filter((l) => l.status === 'completed').length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lessons Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="upcoming">
            <TabsList className="mb-6">
              <TabsTrigger value="upcoming">
                Upcoming ({upcomingLessons?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="past">
                Past ({pastLessons?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : upcomingLessons && upcomingLessons.length > 0 ? (
                <div className="space-y-3">
                  {upcomingLessons.map((lesson) => (
                    <LessonCard key={lesson.id} lesson={lesson} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No upcoming lessons</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => openDrawer('lesson', 'new')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule a Lesson
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="past">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : pastLessons && pastLessons.length > 0 ? (
                <div className="space-y-3">
                  {pastLessons.slice(0, 20).map((lesson) => (
                    <LessonCard key={lesson.id} lesson={lesson} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No past lessons yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

