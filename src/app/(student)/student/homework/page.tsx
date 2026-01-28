'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { BookOpenCheck, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import type { HomeworkStatus } from '@/types/database'
import {
  normalizeHomeworkStatus,
  presentHomeworkStatus,
} from '@/lib/homework-status'

type HomeworkWithRelations = {
  id: string
  title: string
  description: string | null
  due_date: string
  status: HomeworkStatus
  teacher_id: string
  student_id: string
  teacher: {
    id: string
    full_name: string
    avatar_url: string | null
    email: string | null
  } | null
}

export default function StudentHomeworkPage() {
  const supabase = createClient()
  const { openDrawer } = useAppStore()

  const { data: studentRows } = useQuery({
    queryKey: ['student-account-homework'],
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

  const { data: homework, isLoading } = useQuery({
    queryKey: ['student-homework', studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homework')
        .select('*, teacher:profiles(id, full_name, avatar_url, email)')
        .in('student_id', studentIds)
        .order('due_date', { ascending: true })
      if (error) throw error
      return (data || []) as HomeworkWithRelations[]
    },
  })

  const categorized = useMemo(() => {
    const list = homework || []
    const toDo = list.filter((hw) =>
      ['assigned', 'needs_revision', 'overdue'].includes(normalizeHomeworkStatus(hw.status))
    )
    const submitted = list.filter((hw) => normalizeHomeworkStatus(hw.status) === 'submitted')
    const reviewed = list.filter((hw) => normalizeHomeworkStatus(hw.status) === 'reviewed')
    return { toDo, submitted, reviewed, all: list }
  }, [homework])

  const HomeworkCard = ({ hw }: { hw: HomeworkWithRelations }) => {
    const { label, badge } = presentHomeworkStatus({
      status: hw.status,
      dueDate: hw.due_date,
      role: 'student',
    })

    return (
      <div
        className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
        onClick={() => openDrawer('student-homework', hw.id)}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={hw.teacher?.avatar_url || undefined} />
          <AvatarFallback>
            {(hw.teacher?.full_name || 'T')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{hw.title}</h3>
            <Badge className={badge}>
              {label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {hw.teacher?.full_name || 'Your teacher'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">Due {format(new Date(hw.due_date), 'MMM d')}</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(hw.due_date), 'h:mm a')}
          </p>
        </div>
      </div>
    )
  }

  const renderTab = (list: HomeworkWithRelations[], empty: React.ReactNode) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )
    }
    if (!list.length) {
      return <div className="text-center py-12 text-muted-foreground space-y-2">{empty}</div>
    }
    return (
      <div className="space-y-3">
        {list.map((hw) => (
          <HomeworkCard key={hw.id} hw={hw} />
        ))}
      </div>
    )
  }

  return (
    <section className="p-8 space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">To Do</p>
              <p className="text-2xl font-bold">{categorized.toDo.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BookOpenCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Submitted</p>
              <p className="text-2xl font-bold">{categorized.submitted.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reviewed</p>
              <p className="text-2xl font-bold">{categorized.reviewed.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="todo">
            <TabsList className="mb-6">
              <TabsTrigger value="todo">To Do ({categorized.toDo.length})</TabsTrigger>
              <TabsTrigger value="submitted">
                Submitted ({categorized.submitted.length})
              </TabsTrigger>
              <TabsTrigger value="reviewed">Reviewed ({categorized.reviewed.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="todo">
              {renderTab(
                categorized.toDo,
                <>
                  <AlertTriangle className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p>No homework to do right now.</p>
                  <p className="text-sm">New assignments will appear here.</p>
                </>
              )}
            </TabsContent>

            <TabsContent value="submitted">
              {renderTab(
                categorized.submitted,
                <>
                  <BookOpenCheck className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p>Nothing submitted yet.</p>
                  <p className="text-sm">Submit homework to see it here.</p>
                </>
              )}
            </TabsContent>

            <TabsContent value="reviewed">
              {renderTab(
                categorized.reviewed,
                <>
                  <CheckCircle className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p>No reviewed homework yet.</p>
                  <p className="text-sm">Feedback will show up once your teacher reviews.</p>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  )
}
