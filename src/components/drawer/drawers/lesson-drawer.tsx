'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer, DrawerSection, DrawerFooter } from '../drawer'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { FileText, Trash2, Save, CheckCircle, XCircle, Check, ChevronsUpDown, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LessonVideoCall } from '@/components/lesson/lesson-video-call'
import { LessonChat } from '@/components/lesson/lesson-chat'
import { cn } from '@/lib/utils'
import type { Lesson, Student, LessonStatus, Material } from '@/types/database'

interface LessonDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

type LessonParticipant = {
  student_id: string
  student: Pick<Student, 'id' | 'full_name' | 'email' | 'avatar_url'> | null
}

type LessonParticipantRow = {
  student_id: string
  student:
    | { id: string; full_name: string; email: string; avatar_url: string | null }
    | { id: string; full_name: string; email: string; avatar_url: string | null }[]
    | null
}

export function LessonDrawer({ id, data }: LessonDrawerProps) {
  const { closeDrawer, user, openDrawer } = useAppStore()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const isNew = !id || id === 'new'

  // Helper to convert UTC date to local datetime-local format
  const toLocalDateTimeString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const [formData, setFormData] = useState({
    student_id: (data?.studentId as string) || '',
    title: '',
    description: '',
    start_time: data?.startTime ? toLocalDateTimeString(new Date(data.startTime as string)) : '',
    end_time: data?.endTime ? toLocalDateTimeString(new Date(data.endTime as string)) : '',
    status: 'pending' as LessonStatus,
    credits_used: 1,
  })
  const [preAgreed, setPreAgreed] = useState(false)
  const [groupLesson, setGroupLesson] = useState(false)
  const [additionalStudentIds, setAdditionalStudentIds] = useState<string[]>([])
  const [additionalStudentsOpen, setAdditionalStudentsOpen] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [materialsPopoverOpen, setMaterialsPopoverOpen] = useState(false)
  const [participantToAdd, setParticipantToAdd] = useState('')

  // Fetch lesson data
  const { data: lesson, isLoading } = useQuery({
    queryKey: ['lesson', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await supabase
        .from('lessons')
        .select('*, student:students!lessons_student_id_fkey(id, full_name, email, avatar_url)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Lesson & { student: Pick<Student, 'id' | 'full_name' | 'email' | 'avatar_url'> }
    },
    enabled: !isNew && !!id,
  })

  // Fetch students for dropdown
  const { data: students } = useQuery({
    queryKey: ['students-list', user?.id],
    queryFn: async () => {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !authUser) throw authError || new Error('Not authenticated')
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, email, avatar_url, credits')
        .eq('teacher_id', authUser.id)
        .order('full_name')
      if (error) throw error
      return data
    },
    enabled: true,
  })

  // Fetch lesson notes
  const { data: lessonNotes } = useQuery({
    queryKey: ['lesson-notes', id],
    queryFn: async () => {
      if (isNew) return []
      const { data, error } = await supabase
        .from('lesson_notes')
        .select('*')
        .eq('lesson_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !isNew && !!id,
  })

  // Fetch materials for multi-select
  const { data: materials } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('teacher_id', user?.id)
        .order('title')
      if (error) throw error
      return data as Material[]
    },
    enabled: !!user?.id,
  })

  // Fetch lesson materials (for existing lessons)
  const { data: lessonMaterials } = useQuery({
    queryKey: ['lesson-materials', id],
    queryFn: async () => {
      if (isNew) return []
      const { data, error } = await supabase
        .from('lesson_materials')
        .select('material_id')
        .eq('lesson_id', id)
      if (error) throw error
      return data.map((lm) => lm.material_id)
    },
    enabled: !isNew && !!id,
  })

  const { data: lessonParticipants, isLoading: participantsLoading } = useQuery({
    queryKey: ['lesson-participants', id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_students')
        .select('student_id, student:students(id, full_name, email, avatar_url)')
        .eq('lesson_id', id)
      if (error) throw error
      const rows = (data || []) as LessonParticipantRow[]
      return rows.map((row) => {
        const student = Array.isArray(row.student) ? row.student?.[0] : row.student
        return {
          student_id: row.student_id,
          student: student ?? null,
        } satisfies LessonParticipant
      })
    },
  })

  const availableParticipants = useMemo(() => {
    if (!students) return []
    const existingIds = new Set((lessonParticipants || []).map((participant) => participant.student_id))
    return students.filter((student) => !existingIds.has(student.id))
  }, [students, lessonParticipants])

  // Update form when lesson data loads
  useEffect(() => {
    if (lesson) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        student_id: lesson.student_id,
        title: lesson.title,
        description: lesson.description || '',
        start_time: toLocalDateTimeString(new Date(lesson.start_time)),
        end_time: toLocalDateTimeString(new Date(lesson.end_time)),
        status: lesson.status,
        credits_used: lesson.credits_used,
      })
      setIsRecurring(lesson.is_recurring || false)
    }
  }, [lesson])

  // Update selected materials when lesson materials load
  useEffect(() => {
    if (lessonMaterials) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMaterials(lessonMaterials)
    }
  }, [lessonMaterials])

  // When primary student changes, ensure it's not also selected as an additional participant
  useEffect(() => {
    if (!groupLesson) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdditionalStudentIds((prev) => prev.filter((id) => id !== formData.student_id))
  }, [groupLesson, formData.student_id])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Determine status: if pre-agreed is checked, status is confirmed, otherwise pending
      const finalStatus = isNew ? (preAgreed ? 'confirmed' : 'pending') : data.status

      const payload = {
        ...data,
        status: finalStatus,
        start_time: new Date(data.start_time).toISOString(),
        end_time: new Date(data.end_time).toISOString(),
        teacher_id: user?.id,
        is_recurring: isRecurring,
      }

      let lessonId: string

      if (isNew) {
        const res = await fetch('/api/teacher/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: payload.student_id,
            additional_student_ids: groupLesson ? additionalStudentIds : [],
            title: payload.title,
            description: payload.description,
            start_time: payload.start_time,
            end_time: payload.end_time,
            credits_used: payload.credits_used,
            is_recurring: payload.is_recurring,
            status: payload.status,
          }),
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = json?.error || 'Failed to create lesson.'
          throw new Error(message)
        }

        lessonId = json?.lesson?.id ?? json?.id
        if (!lessonId) throw new Error('Lesson creation response missing id')

        // Save lesson materials
        if (selectedMaterials.length > 0) {
          const materialsToInsert = selectedMaterials.map((materialId) => ({
            lesson_id: lessonId,
            material_id: materialId,
          }))
          const { error: materialsError } = await supabase
            .from('lesson_materials')
            .insert(materialsToInsert)
          if (materialsError) throw materialsError
        }
      } else {
        // Existing lesson: route through teacher API for validation/reschedule rules
        const body: Record<string, unknown> = {
          title: payload.title,
          description: payload.description,
          start_time: payload.start_time,
          end_time: payload.end_time,
        }

        const res = await fetch(`/api/teacher/lessons/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = json?.error || 'Failed to update lesson.'
          throw new Error(message)
        }

        lessonId = id as string

        // Update lesson materials
        const { error: deleteError } = await supabase
          .from('lesson_materials')
          .delete()
          .eq('lesson_id', lessonId)
        if (deleteError) throw deleteError

        if (selectedMaterials.length > 0) {
          const materialsToInsert = selectedMaterials.map((materialId) => ({
            lesson_id: lessonId,
            material_id: materialId,
          }))
          const { error: materialsError } = await supabase
            .from('lesson_materials')
            .insert(materialsToInsert)
          if (materialsError) throw materialsError
        }
      }

      return { id: lessonId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      queryClient.invalidateQueries({ queryKey: ['lesson', id] })
      queryClient.invalidateQueries({ queryKey: ['lesson-materials', id] })
      toast.success(isNew ? 'Lesson created' : 'Lesson updated')
      if (isNew) closeDrawer()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to save lesson'
      toast.error(message)
      console.error(error)
    },
  })

  // Status / cancel mutation via teacher API
  const statusMutation = useMutation({
    mutationFn: async (next: LessonStatus | 'cancel') => {
      if (!id) throw new Error('Missing lesson id')
      const isCancel = next === 'cancel'
      const body = isCancel ? { action: 'cancel' } : { status: next }

      const res = await fetch(`/api/teacher/lessons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = json?.error || 'Failed to update status'
        throw new Error(message)
      }
      return next
    },
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      queryClient.invalidateQueries({ queryKey: ['lesson', id] })
      toast.success(next === 'cancel' ? 'Lesson cancelled' : `Lesson marked as ${next}`)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update status'
      toast.error(message)
    },
  })

  const addParticipantMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!id) throw new Error('Missing lesson id')
      const { error } = await supabase.from('lesson_students').insert({
        lesson_id: id,
        student_id: studentId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-participants', id] })
      toast.success('Participant added')
      setParticipantToAdd('')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to add participant'
      toast.error(message)
    },
  })

  const removeParticipantMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!id) throw new Error('Missing lesson id')
      const { error } = await supabase
        .from('lesson_students')
        .delete()
        .eq('lesson_id', id)
        .eq('student_id', studentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-participants', id] })
      toast.success('Participant removed')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to remove participant'
      toast.error(message)
    },
  })

  const handleSave = () => {
    if (!formData.student_id || !formData.title || !formData.start_time || !formData.end_time) {
      toast.error('Please fill in all required fields')
      return
    }
    if (!formData.credits_used || formData.credits_used < 1) {
      toast.error('Credits must be at least 1')
      return
    }
    if (groupLesson) {
      // Defensive: ensure primary student isn't duplicated in additional list
      setAdditionalStudentIds((prev) => prev.filter((id) => id !== formData.student_id))
    }
    if (!isNew && lesson) {
      const isPast = new Date(lesson.start_time) <= new Date()
      if (isPast || lesson.status === 'cancelled' || lesson.status === 'completed') {
        toast.error('Cannot edit past, cancelled, or completed lessons')
        return
      }
    }
    saveMutation.mutate(formData)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getStatusBadgeClass = (status: LessonStatus) => {
    switch (status) {
      case 'completed': return 'badge-completed'
      case 'confirmed': return 'badge-confirmed'
      case 'cancelled': return 'badge-cancelled'
      default: return 'badge-pending'
    }
  }

  const primaryStudentId = lesson?.student_id ?? null

  const additionalStudentOptions = useMemo(() => {
    if (!students) return []
    const primary = formData.student_id
    return students.filter((student) => student.id !== primary)
  }, [students, formData.student_id])

  const detailsContent = (
    <div className="space-y-6">
          {/* Student Info (for existing lessons) */}
          {!isNew && lesson?.student && (
            <div
              className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
              onClick={() => openDrawer('student', lesson.student.id)}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={lesson.student.avatar_url || undefined} />
                <AvatarFallback>{getInitials(lesson.student.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{lesson.student.full_name}</p>
                <p className="text-sm text-muted-foreground">{lesson.student.email}</p>
              </div>
              <Badge className={getStatusBadgeClass(lesson.status)}>
                {lesson.status}
              </Badge>
            </div>
          )}

          {/* Quick Status Actions */}
          {!isNew && lesson && (
            <div className="flex gap-2">
              {lesson.status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => statusMutation.mutate('confirmed')}
                  disabled={statusMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                  Confirm
                </Button>
              )}
              {lesson.status !== 'cancelled' && lesson.status !== 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => statusMutation.mutate('completed')}
                  disabled={statusMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Complete
                </Button>
              )}
              {lesson.status !== 'completed' &&
                lesson.status !== 'cancelled' &&
                new Date(lesson.start_time) > new Date() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this lesson?')) {
                        statusMutation.mutate('cancel')
                      }
                    }}
                    disabled={statusMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 text-destructive" />
                  </Button>
                )}
            </div>
          )}

          <Separator />

          {/* Form Fields */}
          <DrawerSection title="Lesson Details">
            <div className="grid gap-4">
              {isNew && (
                <div className="grid gap-2">
                  <Label htmlFor="student">Student *</Label>
                  <Select
                    value={formData.student_id}
                    onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students?.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          <div className="flex items-center gap-2">
                            <span>{student.full_name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({student.credits} credits)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2 pt-1">
                    <Checkbox
                      id="group_lesson"
                      checked={groupLesson}
                      onCheckedChange={(checked) => {
                        const next = checked === true
                        setGroupLesson(next)
                        if (!next) {
                          setAdditionalStudentIds([])
                          setAdditionalStudentsOpen(false)
                        } else {
                          // Ensure no duplication with primary
                          setAdditionalStudentIds((prev) => prev.filter((id) => id !== formData.student_id))
                        }
                      }}
                    />
                    <Label
                      htmlFor="group_lesson"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Group Lesson
                    </Label>
                  </div>

                  {groupLesson && (
                    <div className="grid gap-2 pt-2">
                      <Label htmlFor="additional_students">Additional students</Label>
                      <Popover open={additionalStudentsOpen} onOpenChange={setAdditionalStudentsOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            disabled={!formData.student_id}
                          >
                            {additionalStudentIds.length > 0
                              ? `${additionalStudentIds.length} additional student${additionalStudentIds.length > 1 ? 's' : ''} selected`
                              : 'Select additional students...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search students..." />
                            <CommandList>
                              <CommandEmpty>No students found.</CommandEmpty>
                              <CommandGroup>
                                {additionalStudentOptions.map((student) => (
                                  <CommandItem
                                    key={student.id}
                                    value={student.id}
                                    onSelect={() => {
                                      setAdditionalStudentIds((prev) =>
                                        prev.includes(student.id)
                                          ? prev.filter((id) => id !== student.id)
                                          : [...prev, student.id]
                                      )
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        additionalStudentIds.includes(student.id)
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    <span className="flex items-center gap-2">
                                      <span>{student.full_name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        ({student.credits} credits)
                                      </span>
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {additionalStudentIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {additionalStudentIds.map((studentId) => {
                            const student = students?.find((s) => s.id === studentId)
                            if (!student) return null
                            return (
                              <Badge
                                key={studentId}
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                {student.full_name}
                                <button
                                  onClick={() =>
                                    setAdditionalStudentIds((prev) =>
                                      prev.filter((id) => id !== studentId)
                                    )
                                  }
                                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Conversation Practice"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_time">End Time *</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Lesson plan, topics to cover..."
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="attached_materials">Attached Materials</Label>
                <Popover open={materialsPopoverOpen} onOpenChange={setMaterialsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedMaterials.length > 0
                        ? `${selectedMaterials.length} material${selectedMaterials.length > 1 ? 's' : ''} selected`
                        : 'Select materials...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search materials..." />
                      <CommandList>
                        <CommandEmpty>No materials found.</CommandEmpty>
                        <CommandGroup>
                          {materials?.map((material) => (
                            <CommandItem
                              key={material.id}
                              value={material.id}
                              onSelect={() => {
                                setSelectedMaterials((prev) =>
                                  prev.includes(material.id)
                                    ? prev.filter((id) => id !== material.id)
                                    : [...prev, material.id]
                                )
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedMaterials.includes(material.id)
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              {material.title}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedMaterials.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedMaterials.map((materialId) => {
                      const material = materials?.find((m) => m.id === materialId)
                      return material ? (
                        <Badge
                          key={materialId}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {material.title}
                          <button
                            onClick={() =>
                              setSelectedMaterials((prev) =>
                                prev.filter((id) => id !== materialId)
                              )
                            }
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}
              </div>

                <div className="grid gap-2">
                <Label htmlFor="credits_used">Credits *</Label>
                  <Input
                    id="credits_used"
                    type="number"
                  min="1"
                  required
                    value={formData.credits_used}
                    onChange={(e) =>
                    setFormData({ ...formData, credits_used: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>

              {/* Status picker - only show for existing lessons */}
              {!isNew && (
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value as LessonStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Checkboxes - only show for new lessons */}
              {isNew && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pre_agreed"
                      checked={preAgreed}
                      onCheckedChange={(checked) => setPreAgreed(checked === true)}
                    />
                    <Label
                      htmlFor="pre_agreed"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Pre-agreed with {groupLesson ? 'students' : 'student'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_recurring"
                      checked={isRecurring}
                      onCheckedChange={(checked) => setIsRecurring(checked === true)}
                    />
                    <Label
                      htmlFor="is_recurring"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Make this a recurring lesson
                    </Label>
                </div>
              </div>
              )}
            </div>
          </DrawerSection>

          {/* Lesson Notes (for existing lessons) */}
          {!isNew && (
            <>
              <Separator />
              <DrawerSection title="Lesson Notes">
                {lessonNotes && lessonNotes.length > 0 ? (
                  <div className="space-y-3">
                    {lessonNotes.map((note) => (
                      <div key={note.id} className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(note.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No notes yet</p>
                  </div>
                )}
              </DrawerSection>
            </>
          )}
          {!isNew && lesson && (
            <>
              <Separator />
              <DrawerSection title="Participants">
                {participantsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading participants…</p>
                ) : lessonParticipants && lessonParticipants.length > 0 ? (
                  <div className="space-y-3">
                    {lessonParticipants.map((participant) => {
                      const isPrimary = participant.student_id === primaryStudentId
                      return (
                        <div
                          key={participant.student_id}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                        >
                          <div>
                            <p className="font-medium">
                              {participant.student?.full_name || 'Student'}
                            </p>
                            {participant.student?.email && (
                              <p className="text-xs text-muted-foreground">
                                {participant.student.email}
                              </p>
                            )}
                          </div>
                          {isPrimary ? (
                            <Badge className="badge-confirmed">Primary</Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeParticipantMutation.mutate(participant.student_id)}
                              disabled={removeParticipantMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No additional participants yet. Add students to invite them to the live call.
                  </p>
                )}

                {availableParticipants.length > 0 && (
                  <div className="mt-4 flex gap-2">
                    <Select value={participantToAdd} onValueChange={setParticipantToAdd}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select student to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableParticipants.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => participantToAdd && addParticipantMutation.mutate(participantToAdd)}
                      disabled={!participantToAdd || addParticipantMutation.isPending}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </DrawerSection>
            </>
          )}
        </div>
  )

  return (
    <Drawer
      title={isNew ? 'Schedule Lesson' : lesson?.title || 'Lesson'}
      subtitle={
        isNew
          ? 'Create a new lesson'
          : lesson
          ? format(new Date(lesson.start_time), "EEEE, MMMM d 'at' h:mm a")
          : undefined
      }
      width="lg"
      footer={
        <DrawerFooter>
          <div className="flex-1" />
          <Button variant="outline" onClick={closeDrawer}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {isNew ? 'Create Lesson' : 'Save Changes'}
          </Button>
        </DrawerFooter>
      }
    >
      {isLoading && !isNew ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : isNew || !lesson ? (
        detailsContent
      ) : (
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="live">Live session</TabsTrigger>
          </TabsList>
          <TabsContent value="details">{detailsContent}</TabsContent>
          <TabsContent value="live">
            <div className="grid gap-4 lg:grid-cols-2">
              <LessonVideoCall lessonId={lesson.id} className="h-[500px]" />
              <LessonChat lessonId={lesson.id} className="h-[500px]" />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </Drawer>
  )
}

