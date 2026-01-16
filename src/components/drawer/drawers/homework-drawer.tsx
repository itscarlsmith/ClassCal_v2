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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Calendar,
  FileText,
  Trash2,
  Save,
  CheckCircle,
  Clock,
  Download,
  MessageSquare,
} from 'lucide-react'
import type { Homework, Student, HomeworkSubmission, HomeworkStatus } from '@/types/database'

interface HomeworkDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

export function HomeworkDrawer({ id, data }: HomeworkDrawerProps) {
  const { closeDrawer, user, openDrawer } = useAppStore()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const isNew = !id || id === 'new'

  const [formData, setFormData] = useState({
    student_id: (data?.studentId as string) || '',
    title: '',
    description: '',
    due_date: '',
    status: 'assigned' as HomeworkStatus,
  })

  const [feedback, setFeedback] = useState('')
  const [grade, setGrade] = useState('')

  // Fetch homework data
  const { data: homework, isLoading } = useQuery({
    queryKey: ['homework', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await supabase
        .from('homework')
        .select('*, student:students(id, full_name, email, avatar_url)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Homework & { student: Pick<Student, 'id' | 'full_name' | 'email' | 'avatar_url'> }
    },
    enabled: !isNew && !!id,
  })

  // Fetch submission
  const { data: submission } = useQuery({
    queryKey: ['homework-submission', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('homework_id', id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data as HomeworkSubmission | null
    },
    enabled: !isNew && !!id,
  })

  // Fetch students for dropdown
  const { data: students } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, email, avatar_url')
        .eq('teacher_id', user?.id)
        .order('full_name')
      if (error) throw error
      return data
    },
    enabled: !!user?.id && isNew,
  })

  // Update form when homework data loads
  useEffect(() => {
    if (homework) {
      setFormData({
        student_id: homework.student_id,
        title: homework.title,
        description: homework.description || '',
        due_date: new Date(homework.due_date).toISOString().slice(0, 16),
        status: homework.status,
      })
    }
  }, [homework])

  useEffect(() => {
    if (submission) {
      setFeedback(submission.feedback || '')
      setGrade(submission.grade || '')
    }
  }, [submission])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        due_date: new Date(data.due_date).toISOString(),
        teacher_id: user?.id,
      }

      if (isNew) {
        const { data: newHomework, error } = await supabase
          .from('homework')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return newHomework
      } else {
        const { data: updated, error } = await supabase
          .from('homework')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      queryClient.invalidateQueries({ queryKey: ['homework', id] })
      toast.success(isNew ? 'Homework assigned' : 'Homework updated')
      if (isNew) closeDrawer()
    },
    onError: (error) => {
      toast.error('Failed to save homework')
      console.error(error)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('homework').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      toast.success('Homework deleted')
      closeDrawer()
    },
    onError: (error) => {
      toast.error('Failed to delete homework')
      console.error(error)
    },
  })

  // Review submission mutation
  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!submission) return
      
      // Update submission with feedback
      const { error: subError } = await supabase
        .from('homework_submissions')
        .update({
          feedback,
          grade,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission.id)
      if (subError) throw subError

      // Update homework status
      const { error: hwError } = await supabase
        .from('homework')
        .update({ status: 'reviewed' })
        .eq('id', id)
      if (hwError) throw hwError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      queryClient.invalidateQueries({ queryKey: ['homework', id] })
      queryClient.invalidateQueries({ queryKey: ['homework-submission', id] })
      toast.success('Review submitted')
    },
    onError: (error) => {
      toast.error('Failed to submit review')
      console.error(error)
    },
  })

  const handleSave = () => {
    if (!formData.student_id || !formData.title || !formData.due_date) {
      toast.error('Please fill in all required fields')
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

  const getStatusBadgeClass = (status: HomeworkStatus) => {
    switch (status) {
      case 'reviewed': return 'badge-completed'
      case 'submitted': return 'badge-confirmed'
      case 'overdue': return 'badge-cancelled'
      default: return 'badge-pending'
    }
  }

  return (
    <Drawer
      title={isNew ? 'Assign Homework' : homework?.title || 'Homework'}
      subtitle={
        isNew
          ? 'Create a new homework assignment'
          : homework
          ? `Due ${format(new Date(homework.due_date), 'MMM d, yyyy')}`
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
                if (confirm('Are you sure you want to delete this homework?')) {
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
            {isNew ? 'Assign Homework' : 'Save Changes'}
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
          {/* Student Info (for existing homework) */}
          {!isNew && homework?.student && (
            <div
              className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
              onClick={() => openDrawer('student', homework.student.id)}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={homework.student.avatar_url || undefined} />
                <AvatarFallback>{getInitials(homework.student.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{homework.student.full_name}</p>
                <p className="text-sm text-muted-foreground">{homework.student.email}</p>
              </div>
              <Badge className={getStatusBadgeClass(homework.status)}>
                {homework.status}
              </Badge>
            </div>
          )}

          {/* Submission Section (if submitted) */}
          {!isNew && submission && (
            <>
              <DrawerSection title="Submission">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">
                      Submitted {format(new Date(submission.submitted_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  
                  {submission.content && (
                    <div className="bg-white dark:bg-card p-3 rounded-lg mb-3">
                      <p className="text-sm whitespace-pre-wrap">{submission.content}</p>
                    </div>
                  )}
                  
                  {submission.file_urls && submission.file_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {submission.file_urls.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-card rounded-md text-sm hover:bg-muted transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          File {index + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </DrawerSection>

              {/* Review Section */}
              <DrawerSection title="Review & Feedback">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="grade">Grade</Label>
                    <Input
                      id="grade"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="A, B+, 95%, etc."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="feedback">Feedback</Label>
                    <Textarea
                      id="feedback"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Provide feedback for the student..."
                      rows={4}
                    />
                  </div>
                  {homework?.status === 'submitted' && (
                    <Button
                      onClick={() => reviewMutation.mutate()}
                      disabled={reviewMutation.isPending}
                      className="w-full"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Submit Review
                    </Button>
                  )}
                </div>
              </DrawerSection>

              <Separator />
            </>
          )}

          {/* Form Fields */}
          <DrawerSection title="Assignment Details">
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
                          {student.full_name}
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
                  placeholder="e.g., Vocabulary Practice"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="due_date">Due Date *</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Instructions</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what the student needs to do..."
                  rows={4}
                />
              </div>

              {!isNew && (
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value as HomeworkStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </DrawerSection>
        </div>
      )}
    </Drawer>
  )
}

