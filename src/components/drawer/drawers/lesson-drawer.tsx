'use client'

import { useState, useEffect } from 'react'
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
import {
  Calendar,
  Clock,
  User,
  Video,
  FileText,
  BookOpen,
  Trash2,
  Save,
  CheckCircle,
  XCircle,
  ExternalLink,
  Check,
  ChevronsUpDown,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lesson, Student, LessonStatus, Material } from '@/types/database'

interface LessonDrawerProps {
  id: string | null
  data?: Record<string, unknown>
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
    meeting_url: '',
  })
  const [preAgreed, setPreAgreed] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [materialsPopoverOpen, setMaterialsPopoverOpen] = useState(false)

  // Fetch lesson data
  const { data: lesson, isLoading } = useQuery({
    queryKey: ['lesson', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await supabase
        .from('lessons')
        .select('*, student:students(id, full_name, email, avatar_url)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Lesson & { student: Pick<Student, 'id' | 'full_name' | 'email' | 'avatar_url'> }
    },
    enabled: !isNew && !!id,
  })

  // Fetch students for dropdown
  const { data: students } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, email, avatar_url, credits')
        .eq('teacher_id', user?.id)
        .order('full_name')
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
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

  // Update form when lesson data loads
  useEffect(() => {
    if (lesson) {
      setFormData({
        student_id: lesson.student_id,
        title: lesson.title,
        description: lesson.description || '',
        start_time: toLocalDateTimeString(new Date(lesson.start_time)),
        end_time: toLocalDateTimeString(new Date(lesson.end_time)),
        status: lesson.status,
        credits_used: lesson.credits_used,
        meeting_url: lesson.meeting_url || '',
      })
      setIsRecurring(lesson.is_recurring || false)
    }
  }, [lesson])

  // Update selected materials when lesson materials load
  useEffect(() => {
    if (lessonMaterials) {
      setSelectedMaterials(lessonMaterials)
    }
  }, [lessonMaterials])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Determine status: if pre-agreed is checked, status is confirmed, otherwise pending
      // For new lessons, use the checkbox. For existing lessons, keep the current status unless it's being explicitly changed
      const finalStatus = isNew 
        ? (preAgreed ? 'confirmed' : 'pending')
        : data.status

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
        const { data: newLesson, error } = await supabase
          .from('lessons')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        lessonId = newLesson.id

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
        const { data: updated, error } = await supabase
          .from('lessons')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        lessonId = updated.id

        // Update lesson materials
        // First, delete existing materials
        const { error: deleteError } = await supabase
          .from('lesson_materials')
          .delete()
          .eq('lesson_id', lessonId)
        if (deleteError) throw deleteError

        // Then, insert new materials
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
      toast.error('Failed to save lesson')
      console.error(error)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('lessons').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      toast.success('Lesson deleted')
      closeDrawer()
    },
    onError: (error) => {
      toast.error('Failed to delete lesson')
      console.error(error)
    },
  })

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: async (newStatus: LessonStatus) => {
      const { error } = await supabase
        .from('lessons')
        .update({ status: newStatus })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      queryClient.invalidateQueries({ queryKey: ['lesson', id] })
      toast.success(`Lesson marked as ${newStatus}`)
    },
    onError: (error) => {
      toast.error('Failed to update status')
      console.error(error)
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
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (confirm('Are you sure you want to delete this lesson?')) {
                  deleteMutation.mutate()
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
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
      ) : (
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

          {/* Quick Status Actions (for existing non-completed lessons) */}
          {!isNew && lesson && lesson.status !== 'completed' && lesson.status !== 'cancelled' && (
            <div className="flex gap-2">
              {lesson.status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => statusMutation.mutate('confirmed')}
                >
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                  Confirm
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => statusMutation.mutate('completed')}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this lesson?')) {
                    statusMutation.mutate('cancelled')
                  }
                }}
              >
                <XCircle className="w-4 h-4 text-destructive" />
              </Button>
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
                      Pre-agreed with student
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

              <div className="grid gap-2">
                <Label htmlFor="meeting_url">Meeting URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="meeting_url"
                    value={formData.meeting_url}
                    onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                    placeholder="https://meet.google.com/..."
                  />
                  {formData.meeting_url && (
                    <Button
                      variant="outline"
                      size="icon"
                      asChild
                    >
                      <a href={formData.meeting_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
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
        </div>
      )}
    </Drawer>
  )
}

