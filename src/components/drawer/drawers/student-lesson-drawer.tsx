'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer, DrawerSection, DrawerFooter } from '../drawer'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LessonVideoCall } from '@/components/lesson/lesson-video-call'
import { LessonChat } from '@/components/lesson/lesson-chat'
import { format } from 'date-fns'
import { useAppStore } from '@/store/app-store'
import type { Lesson } from '@/types/database'
import { toast } from 'sonner'
import { createMaterialSignedUrl } from '@/lib/storage/materials'
import { badgeClassForHomeworkStatus, effectiveHomeworkStatus } from '@/lib/homework-status'

type LessonMaterialSummary = {
  id: string
  title: string
  type: string
  file_url: string | null
  external_url: string | null
}

interface StudentLessonDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

export function StudentLessonDrawer({ id }: StudentLessonDrawerProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { closeDrawer } = useAppStore()
  const [materialOpeningId, setMaterialOpeningId] = useState<string | null>(null)

  const { data: lesson, isLoading } = useQuery({
    queryKey: ['student-lesson', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*, teacher:profiles(id, full_name, avatar_url, email)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Lesson & {
        teacher: { id: string; full_name: string; avatar_url: string | null; email: string | null } | null
      }
    },
  })

  const { data: linkedHomework } = useQuery({
    queryKey: ['student-lesson-homework', id],
    enabled: !!id && !!lesson?.student_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homework')
        .select('id, title, due_date, status, lesson_id, student_id')
        .eq('lesson_id', id)
        .eq('student_id', lesson?.student_id)
        .order('due_date', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  const { data: lessonMaterials } = useQuery({
    queryKey: ['student-lesson-materials', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_materials')
        .select('material:materials(id, title, type, file_url, external_url)')
        .eq('lesson_id', id)
      if (error) throw error
      return (data || [])
        .map((row: any) => {
          const material = Array.isArray(row.material) ? row.material?.[0] : row.material
          return (material ?? null) as LessonMaterialSummary | null
        })
        .filter((material): material is LessonMaterialSummary => !!material)
    },
  })

  const subtitle = useMemo(() => {
    if (!lesson) return undefined
    const start = new Date(lesson.start_time)
    const end = new Date(lesson.end_time)
    return `${format(start, "EEEE, MMM d 'at' h:mm a")} – ${format(end, 'h:mm a')}`
  }, [lesson])

  const statusClass = {
    pending: 'badge-pending',
    confirmed: 'badge-confirmed',
    completed: 'badge-completed',
    cancelled: 'badge-cancelled',
  }

  const statusMutation = useMutation({
    mutationFn: async (action: 'accept' | 'decline' | 'cancel') => {
      if (!id) throw new Error('Missing lesson id')

      const res = await fetch(`/api/student/lessons/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const json = (await res.json().catch(() => ({}))) as {
        lesson?: { status?: Lesson['status'] }
        error?: string
      }

      if (!res.ok) {
        const message = json?.error || 'Failed to update lesson'
        throw new Error(message)
      }

      const statusFromResponse = json.lesson?.status
      const derivedStatus: Lesson['status'] =
        statusFromResponse && ['pending', 'confirmed', 'completed', 'cancelled'].includes(statusFromResponse)
          ? statusFromResponse
          : action === 'accept'
          ? 'confirmed'
          : 'cancelled'

      return { action, status: derivedStatus }
    },
    onSuccess: ({ action, status }) => {
      // Optimistically update the current drawer's lesson data
      queryClient.setQueryData(
        ['student-lesson', id],
        (old: (Lesson & { teacher: any }) | undefined) =>
          old ? { ...old, status } : old
      )

      queryClient.invalidateQueries({ queryKey: ['student-lesson', id] })
      queryClient.invalidateQueries({ queryKey: ['student-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['student-calendar-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      let message = 'Lesson updated'
      if (action === 'accept') message = 'Lesson accepted'
      if (action === 'decline') message = 'Lesson declined'
      if (action === 'cancel') message = 'Lesson cancelled'
      toast.success(message)
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to update lesson'
      toast.error(message)
    },
  })

  const handleAccept = () => statusMutation.mutate('accept')
  const handleDecline = () => {
    if (confirm('Are you sure you want to decline this lesson?')) {
      statusMutation.mutate('decline')
    }
  }
  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel this lesson?')) {
      statusMutation.mutate('cancel')
    }
  }

  const teacherName = lesson?.teacher?.full_name || 'Teacher'
  const homeworkSummary = useMemo(() => {
    if (!linkedHomework || linkedHomework.length === 0) return 'No homework linked'
    const statuses = linkedHomework.map((hw) => effectiveHomeworkStatus(hw.status, hw.due_date))
    if (statuses.every((status) => status === 'reviewed')) return 'Homework reviewed'
    if (statuses.some((status) => status === 'submitted')) return 'Homework submitted'
    if (statuses.some((status) => status === 'overdue')) return 'Homework overdue'
    return 'Homework assigned'
  }, [linkedHomework])

  const openMaterial = async (material: LessonMaterialSummary) => {
    if (material.external_url) {
      window.open(material.external_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (!material.file_url) {
      toast.error('File not available for this material yet.')
      return
    }
    try {
      setMaterialOpeningId(material.id)
      const signedUrl = await createMaterialSignedUrl({
        supabase,
        path: material.file_url,
        expiresIn: 60 * 10,
      })
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error(error)
      toast.error('Unable to open material')
    } finally {
      setMaterialOpeningId(null)
    }
  }

  const renderMaterials = () => {
    if (!lessonMaterials) return null
    if (lessonMaterials.length === 0) {
      return <p className="text-sm text-muted-foreground">No materials attached.</p>
    }

    return (
      <div className="space-y-2">
        {lessonMaterials.map((material) => (
          <div
            key={material.id}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
          >
            <div>
              <p className="font-medium text-sm">{material.title}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {material.type}
              </p>
            </div>
            {material.file_url || material.external_url ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openMaterial(material)}
                disabled={materialOpeningId === material.id && !material.external_url}
              >
                {materialOpeningId === material.id && !material.external_url ? 'Opening…' : 'Open'}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  const detailsContent = lesson ? (
    <div className="space-y-6">
          <DrawerSection>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
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
                <p className="text-lg font-semibold">{teacherName}</p>
                {lesson.teacher?.email && (
                  <p className="text-sm text-muted-foreground">{lesson.teacher.email}</p>
                )}
              </div>
            </div>
            <Badge className={statusClass[lesson.status] || 'badge-pending'}>
              {lesson.status}
            </Badge>
          </DrawerSection>

          {lesson.status === 'pending' && (
            <DrawerSection>
              <div className="space-y-2">
                <Button
                  className="w-full justify-center"
                  onClick={handleAccept}
                  disabled={statusMutation.isPending}
                >
                  Accept lesson
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={handleDecline}
                  disabled={statusMutation.isPending}
                >
                  Decline lesson
                </Button>
              </div>
            </DrawerSection>
          )}

          {lesson.status === 'confirmed' && new Date(lesson.start_time) > new Date() && (
            <DrawerSection>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-center text-destructive border-destructive"
                  onClick={handleCancel}
                  disabled={statusMutation.isPending}
                >
                  Cancel lesson
                </Button>
              </div>
            </DrawerSection>
          )}

          {lesson.description && (
            <DrawerSection title="Notes">
              <p className="text-sm text-muted-foreground">{lesson.description}</p>
            </DrawerSection>
          )}

          <DrawerSection title="Linked homework">
            {linkedHomework && linkedHomework.length > 0 ? (
              <div className="space-y-3">
                {linkedHomework.map((hw) => {
                  const statusLabel = effectiveHomeworkStatus(hw.status, hw.due_date)
                  return (
                    <div
                      key={hw.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{hw.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {format(new Date(hw.due_date), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <Badge
                        className={badgeClassForHomeworkStatus(hw.status, hw.due_date)}
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No homework linked to this lesson.
              </p>
            )}
          </DrawerSection>

          <DrawerSection title="Materials">{renderMaterials()}</DrawerSection>

          <DrawerSection title="Completeness">
            <p className="text-sm">{homeworkSummary}</p>
          </DrawerSection>

        </div>
  ) : null

  return (
    <Drawer
      title={lesson?.title || 'Lesson details'}
      subtitle={subtitle}
      width="md"
      footer={
        <DrawerFooter>
          <Button variant="outline" onClick={closeDrawer}>
            Close
          </Button>
        </DrawerFooter>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : lesson ? (
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="live">Live session</TabsTrigger>
          </TabsList>
          <TabsContent value="details">{detailsContent}</TabsContent>
          <TabsContent value="live">
            <div className="grid gap-4 lg:grid-cols-2">
              <LessonVideoCall lessonId={lesson.id} className="h-[460px]" />
              <LessonChat lessonId={lesson.id} className="h-[460px]" />
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <p className="text-sm text-muted-foreground">Lesson details not available.</p>
      )}
    </Drawer>
  )
}

