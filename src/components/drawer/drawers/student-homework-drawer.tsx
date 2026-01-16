'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Drawer, DrawerSection, DrawerFooter } from '../drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Material } from '@/types/database'
import { useAppStore } from '@/store/app-store'
import { createMaterialSignedUrl } from '@/lib/storage/materials'
import { isJoinWindowOpen } from '@/lib/lesson-join'
import { useNow } from '@/lib/lesson-join-client'
import {
  uploadHomeworkSubmissionFile,
  createHomeworkSubmissionSignedUrl,
} from '@/lib/storage/homework-submissions'
import { isHomeworkOverdue, normalizeHomeworkStatus, presentHomeworkStatus } from '@/lib/homework-status'

type MaterialSummary = Pick<Material, 'id' | 'title' | 'type' | 'file_url' | 'external_url'>

type MaterialRow = {
  material: MaterialSummary | MaterialSummary[] | null
}

interface StudentHomeworkDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

export function StudentHomeworkDrawer({ id }: StudentHomeworkDrawerProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { closeDrawer } = useAppStore()
  const [submissionText, setSubmissionText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [materialOpeningId, setMaterialOpeningId] = useState<string | null>(null)
  const [openingSubmissionPath, setOpeningSubmissionPath] = useState<string | null>(null)
  const now = useNow(30_000)

  const { data: homework, isLoading } = useQuery({
    queryKey: ['student-homework', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homework')
        .select(
          '*, teacher:profiles(id, full_name, avatar_url, email), lesson:lessons(id, title, start_time, end_time, status)'
        )
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: submission } = useQuery({
    queryKey: ['student-homework-submission', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('homework_id', id)
        .eq('is_latest', true)
        .maybeSingle()
      if (error) throw error
      return data || null
    },
  })

  const { data: lessonMaterials } = useQuery({
    queryKey: ['student-lesson-materials', homework?.lesson_id],
    enabled: !!homework?.lesson_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_materials')
        .select('material:materials(id, title, type, file_url, external_url)')
        .eq('lesson_id', homework?.lesson_id as string)
      if (error) throw error
      const rows = (data || []) as MaterialRow[]
      return rows
        .map((row) => (Array.isArray(row.material) ? row.material[0] : row.material))
        .filter((material): material is MaterialSummary => !!material)
    },
  })

  const { data: homeworkMaterials } = useQuery({
    queryKey: ['student-homework-direct-materials', homework?.id],
    enabled: !!homework?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homework_materials')
        .select('material:materials(id, title, type, file_url, external_url)')
        .eq('homework_id', homework?.id as string)
      if (error) throw error
      const rows = (data || []) as MaterialRow[]
      return rows
        .map((row) => (Array.isArray(row.material) ? row.material[0] : row.material))
        .filter((material): material is MaterialSummary => !!material)
    },
  })

  const combinedMaterials = useMemo(() => {
    const map = new Map<string, MaterialSummary>()
    ;(lessonMaterials || []).forEach((material) => {
      if (material?.id) map.set(material.id, material)
    })
    ;(homeworkMaterials || []).forEach((material) => {
      if (material?.id) map.set(material.id, material)
    })
    return Array.from(map.values())
  }, [lessonMaterials, homeworkMaterials])

  useEffect(() => {
    if (submission?.content) {
      setSubmissionText(submission.content)
    }
  }, [submission])

  const isOverdue = useMemo(() => {
    if (!homework) return false
    return isHomeworkOverdue(homework.status, homework.due_date) && !submission
  }, [homework, submission])

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  const uploadSubmissionFile = async (
    studentId: string,
    homeworkId: string,
    submissionId: string
  ): Promise<string | null> => {
    if (!file) return null
    const result = await uploadHomeworkSubmissionFile({
      supabase,
      studentId,
      homeworkId,
      submissionId,
      file,
    })
    return result.path
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!homework) throw new Error('Missing homework')
      if (!homework.student_id) throw new Error('Missing student reference')
      if (!submissionText.trim() && !file) {
        throw new Error('Please add a text response or attach a file.')
      }

      const submissionId = crypto.randomUUID()
      const { error: insertError } = await supabase
        .from('homework_submissions')
        .insert({
        id: submissionId,
        homework_id: homework.id,
        student_id: homework.student_id,
        content: submissionText.trim() || null,
      })
      if (insertError) throw insertError

      if (file) {
        const filePath = await uploadSubmissionFile(homework.student_id, homework.id, submissionId)
        if (filePath) {
          const { error: updateError } = await supabase
            .from('homework_submissions')
            .update({
              file_paths: [filePath],
              original_filenames: [file.name],
            })
            .eq('id', submissionId)
          if (updateError) throw updateError
        }
      }
    },
    onSuccess: () => {
      toast.success('Homework submitted')
      setFile(null)
      queryClient.invalidateQueries({ queryKey: ['student-homework'] })
      queryClient.invalidateQueries({ queryKey: ['student-homework-submission'] })
    },
    onError: (error: unknown) => {
      const err = error as {
        message?: unknown
        details?: unknown
        hint?: unknown
        code?: unknown
      }
      const message =
        (typeof err.message === 'string' && err.message) ||
        (typeof err.details === 'string' && err.details) ||
        (typeof err.hint === 'string' && err.hint) ||
        (error instanceof Error ? error.message : String(error))
      const code = typeof err.code === 'string' ? err.code : null
      toast.error(code ? `${message} (${code})` : message || 'Failed to submit homework')
    },
  })

  const openSubmissionFile = async (path: string) => {
    try {
      setOpeningSubmissionPath(path)
      const signedUrl = await createHomeworkSubmissionSignedUrl({
        supabase,
        path,
        expiresIn: 60 * 10,
      })
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Unable to open file')
    } finally {
      setOpeningSubmissionPath(null)
    }
  }

  const openMaterial = async (material: MaterialSummary) => {
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
    } catch {
      toast.error('Unable to open material')
    } finally {
      setMaterialOpeningId(null)
    }
  }

  const renderMaterials = () => {
    if (!combinedMaterials) return null
    if (combinedMaterials.length === 0) {
      return <p className="text-sm text-muted-foreground">No materials attached.</p>
    }

    return (
      <div className="space-y-2">
        {combinedMaterials.map((material) => (
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
            {(material.file_url || material.external_url) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openMaterial(material)}
                disabled={materialOpeningId === material.id && !material.external_url}
              >
                {materialOpeningId === material.id && !material.external_url ? 'Opening…' : 'Open'}
              </Button>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <Drawer
      title={homework?.title || 'Homework'}
      subtitle={
        homework ? `Due ${format(new Date(homework.due_date), 'MMM d, yyyy h:mm a')}` : undefined
      }
      width="lg"
      footer={
        <DrawerFooter>
          <Button variant="outline" onClick={closeDrawer}>
            Close
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Submitting…' : isOverdue ? 'Submit late' : 'Submit homework'}
          </Button>
        </DrawerFooter>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : homework ? (
        <div className="space-y-6">
          <DrawerSection>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={homework.teacher?.avatar_url || undefined} />
                <AvatarFallback>
                  {getInitials(homework.teacher?.full_name || 'T')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">
                  {homework.teacher?.full_name || 'Your teacher'}
                </p>
                {homework.teacher?.email && (
                  <p className="text-sm text-muted-foreground">{homework.teacher.email}</p>
                )}
              </div>
            </div>
            {(() => {
              const presentation = presentHomeworkStatus({
                status: homework.status,
                dueDate: homework.due_date,
                role: 'student',
              })
              return <Badge className={presentation.badge}>{presentation.label}</Badge>
            })()}
          </DrawerSection>

          {homework.description && (
            <DrawerSection title="Instructions">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{homework.description}</p>
            </DrawerSection>
          )}

          <DrawerSection title="Materials">{renderMaterials()}</DrawerSection>

          {submission && (
            <DrawerSection title="Your submission">
              <div className="space-y-3">
                {submission.content && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-sm whitespace-pre-wrap">{submission.content}</p>
                  </div>
                )}
                {((submission.file_paths && submission.file_paths.length > 0) ||
                  (submission.file_urls && submission.file_urls.length > 0)) && (
                  <div className="flex flex-wrap gap-2">
                    {(submission.file_paths?.length ? submission.file_paths : submission.file_urls).map(
                      (path: string, idx: number) => (
                      <Button
                        key={path}
                        variant="outline"
                        size="sm"
                        onClick={() => openSubmissionFile(path)}
                        disabled={openingSubmissionPath === path}
                      >
                        {openingSubmissionPath === path ? 'Opening…' : `File ${idx + 1}`}
                      </Button>
                      )
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Submitted {format(new Date(submission.submitted_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </DrawerSection>
          )}

          <DrawerSection title="Submit your work">
            <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="text-response">Text response</Label>
                  <Textarea
                    id="text-response"
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    placeholder="Write your answer here..."
                    rows={4}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="files">Attach files (optional)</Label>
                  <Input
                    id="files"
                    type="file"
                    onChange={(e) => setFile((e.target.files && e.target.files[0]) || null)}
                  />
                  {file && (
                    <p className="text-xs text-muted-foreground truncate">{file.name}</p>
                  )}
                </div>
              </div>
          </DrawerSection>

          {normalizeHomeworkStatus(homework.status) === 'reviewed' && (
            <DrawerSection title="Feedback">
              {submission?.feedback ? (
                <div className="space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{submission.feedback}</p>
                  {submission.grade && (
                    <p className="text-sm font-semibold">Grade: {submission.grade}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Reviewed with no feedback.</p>
              )}
            </DrawerSection>
          )}

          <Separator />

          <DrawerSection title="Lesson">
            {homework.lesson ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{homework.lesson.title || 'Lesson'}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(homework.lesson.start_time), 'MMM d, h:mm a')}
                  </p>
                </div>
                {homework.lesson.status === 'confirmed' &&
                  isJoinWindowOpen({
                    startTime: homework.lesson.start_time,
                    endTime: homework.lesson.end_time,
                    now,
                  }) && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`/student/lessons/${homework.lesson.id}/call`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Join
                      </a>
                    </Button>
                  )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No linked lesson.</p>
            )}
          </DrawerSection>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Homework details not available.</p>
      )}
    </Drawer>
  )
}

