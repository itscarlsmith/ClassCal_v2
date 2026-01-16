'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer, DrawerSection, DrawerFooter } from '../drawer'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { 
  CreditCard, 
  Calendar,
  Trash2,
  Save,
  Users
} from 'lucide-react'
import type { Student, Parent } from '@/types/database'

interface StudentDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

export function StudentDrawer({ id, data }: StudentDrawerProps) {
  const { closeDrawer, user } = useAppStore()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const isNew = !id || id === 'new'
  
  void data

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    notes: '',
    hourly_rate: 45,
    credits: 0,
  })

  // Fetch student data
  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await supabase
        .from('students')
        .select('*, parents(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Student & { parents: Parent[] }
    },
    enabled: !isNew && !!id,
    onSuccess: (loadedStudent) => {
      if (!loadedStudent) return
      setFormData({
        full_name: loadedStudent.full_name,
        email: loadedStudent.email,
        phone: loadedStudent.phone || '',
        notes: loadedStudent.notes || '',
        hourly_rate: loadedStudent.hourly_rate,
        credits: loadedStudent.credits,
      })
    },
  })

  // Fetch student's recent lessons
  const { data: recentLessons } = useQuery({
    queryKey: ['student-lessons', id],
    queryFn: async () => {
      if (isNew) return []
      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, start_time, status')
        .eq('student_id', id)
        .order('start_time', { ascending: false })
        .limit(5)
      if (error) throw error
      return data
    },
    enabled: !isNew && !!id,
  })

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Try to find an existing student profile for this email so we can link accounts
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('email', data.email)
        .eq('role', 'student')
        .maybeSingle()

      const payload = {
        ...data,
        teacher_id: user?.id,
        // Link to an existing student account if present so the student can see their data
        user_id: existingProfile?.id ?? null,
      }

      if (isNew) {
        const { data: newStudent, error } = await supabase
          .from('students')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return newStudent
      } else {
        const { data: updated, error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return updated
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['student', id] })
      toast.success(isNew ? 'Student created' : 'Student updated')
      if (isNew) closeDrawer()
    },
    onError: () => {
      toast.error('Failed to save student')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Student deleted')
      closeDrawer()
    },
    onError: () => {
      toast.error('Failed to delete student')
    },
  })

  const handleSave = () => {
    if (!formData.full_name || !formData.email) {
      toast.error('Name and email are required')
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

  return (
    <Drawer
      title={isNew ? 'Add Student' : student?.full_name || 'Student'}
      subtitle={isNew ? 'Create a new student profile' : student?.email}
      width="lg"
      footer={
        <DrawerFooter>
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (confirm('Are you sure you want to delete this student?')) {
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
            {isNew ? 'Create Student' : 'Save Changes'}
          </Button>
        </DrawerFooter>
      }
    >
      {isLoading && !isNew ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            {!isNew && (
              <>
                <TabsTrigger value="lessons" className="flex-1">Lessons</TabsTrigger>
                <TabsTrigger value="payments" className="flex-1">Payments</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {/* Avatar & Quick Stats */}
            {!isNew && student && (
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={student.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">
                    {getInitials(student.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CreditCard className="w-3 h-3 mr-1" />
                      {student.credits} credits
                    </Badge>
                    <Badge variant="outline">
                      ${student.hourly_rate}/hr
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Student since {new Date(student.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <DrawerSection title="Basic Information">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter student name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 555-0100"
                  />
                </div>
              </div>
            </DrawerSection>

            <Separator />

            <DrawerSection title="Billing">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="credits">Credits</Label>
                  <Input
                    id="credits"
                    type="number"
                    min="0"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </DrawerSection>

            <Separator />

            <DrawerSection title="Notes">
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add notes about this student..."
                rows={4}
              />
            </DrawerSection>

            {/* Parents Section */}
            {!isNew && student?.parents && student.parents.length > 0 && (
              <>
                <Separator />
                <DrawerSection title="Parents / Guardians">
                  <div className="space-y-2">
                    {student.parents.map((parent) => (
                      <div 
                        key={parent.id} 
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{parent.full_name}</p>
                          <p className="text-xs text-muted-foreground">{parent.email}</p>
                        </div>
                        {parent.is_primary && (
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </DrawerSection>
              </>
            )}
          </TabsContent>

          {!isNew && (
            <TabsContent value="lessons" className="space-y-4">
              {recentLessons && recentLessons.length > 0 ? (
                <div className="space-y-2">
                  {recentLessons.map((lesson) => (
                    <div 
                      key={lesson.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(lesson.start_time).toLocaleDateString()} at{' '}
                            {new Date(lesson.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary"
                        className={
                          lesson.status === 'completed' ? 'badge-completed' :
                          lesson.status === 'confirmed' ? 'badge-confirmed' :
                          lesson.status === 'cancelled' ? 'badge-cancelled' :
                          'badge-pending'
                        }
                      >
                        {lesson.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No lessons yet</p>
                </div>
              )}
            </TabsContent>
          )}

          {!isNew && (
            <TabsContent value="payments" className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Payment history will appear here</p>
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}
    </Drawer>
  )
}

