'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, BookOpen, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import type { Homework, Student } from '@/types/database'
import {
  effectiveHomeworkStatus,
  normalizeHomeworkStatus,
  presentHomeworkStatus,
} from '@/lib/homework-status'
import { useSearchParams } from 'next/navigation'

type HomeworkWithStudent = Homework & { student: Pick<Student, 'id' | 'full_name' | 'avatar_url'> }

export default function HomeworkPage() {
  const { openDrawer } = useAppStore()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const deepLinkHandledRef = useRef<string | null>(null)

  useEffect(() => {
    const homeworkId = searchParams.get('homework')
    if (!homeworkId || deepLinkHandledRef.current === homeworkId) return
    deepLinkHandledRef.current = homeworkId
    openDrawer('homework', homeworkId)
  }, [openDrawer, searchParams])

  // Fetch homework
  const { data: homework, isLoading } = useQuery({
    queryKey: ['homework'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('homework')
        .select('*, student:students(id, full_name, avatar_url)')
        .eq('teacher_id', userData.user?.id)
        .order('due_date', { ascending: true })
      if (error) throw error
      return data as HomeworkWithStudent[]
    },
  })

  // Group homework by status
  const allHomework = homework || []
  const toReview = allHomework.filter((h) => normalizeHomeworkStatus(h.status) === 'submitted')
  const overdue = allHomework.filter((h) => effectiveHomeworkStatus(h.status, h.due_date) === 'overdue')
  const assigned = allHomework.filter((h) =>
    ['assigned', 'needs_revision'].includes(normalizeHomeworkStatus(h.status))
  )
  const reviewed = allHomework.filter((h) => normalizeHomeworkStatus(h.status) === 'reviewed')

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const HomeworkCard = ({ hw }: { hw: HomeworkWithStudent }) => {
    const presentation = presentHomeworkStatus({
      status: hw.status,
      dueDate: hw.due_date,
      role: 'teacher',
    })

    return (
      <div
        className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
        onClick={() => openDrawer('homework', hw.id)}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={hw.student?.avatar_url || undefined} />
          <AvatarFallback>{getInitials(hw.student?.full_name || 'S')}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{hw.title}</h3>
            <Badge className={presentation.badge}>
              {presentation.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {hw.student?.full_name}
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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => openDrawer('homework', 'new')}>
          <Plus className="w-4 h-4 mr-2" />
          Assign Homework
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{allHomework.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">To Review</p>
              <p className="text-2xl font-bold">{toReview.length}</p>
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
              <p className="text-2xl font-bold">{reviewed.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold">{overdue.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Homework Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="review">
            <TabsList className="mb-6">
              <TabsTrigger value="all">All ({allHomework.length})</TabsTrigger>
              <TabsTrigger value="assigned">Assigned ({assigned.length})</TabsTrigger>
              <TabsTrigger value="review">
                To Review ({toReview.length})
              </TabsTrigger>
              <TabsTrigger value="reviewed">Reviewed ({reviewed.length})</TabsTrigger>
              <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : allHomework.length > 0 ? (
                <div className="space-y-3">
                  {allHomework.map((hw) => (
                    <HomeworkCard key={hw.id} hw={hw} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No homework assignments yet</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => openDrawer('homework', 'new')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Assign Homework
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="review">
              {toReview.length > 0 ? (
                <div className="space-y-3">
                  {toReview.map((hw) => (
                    <HomeworkCard key={hw.id} hw={hw} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No submissions to review</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="assigned">
              {assigned.length > 0 ? (
                <div className="space-y-3">
                  {assigned.map((hw) => (
                    <HomeworkCard key={hw.id} hw={hw} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No pending assignments</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviewed">
              {reviewed.length > 0 ? (
                <div className="space-y-3">
                  {reviewed.map((hw) => (
                    <HomeworkCard key={hw.id} hw={hw} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No reviewed homework yet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="overdue">
              {overdue.length > 0 ? (
                <div className="space-y-3">
                  {overdue.map((hw) => (
                    <HomeworkCard key={hw.id} hw={hw} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No overdue homework!</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

