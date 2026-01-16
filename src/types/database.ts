export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'teacher' | 'student' | 'parent'
export type LessonStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type HomeworkStatus =
  | 'assigned'
  | 'submitted'
  | 'reviewed'
  | 'overdue'
  | 'cancelled'
  | 'needs_revision'
export type RecurrencePattern = 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          role: UserRole
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          avatar_url?: string | null
          role: UserRole
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          role?: UserRole
          timezone?: string
          updated_at?: string
        }
      }
      students: {
        Row: {
          id: string
          teacher_id: string
          user_id: string | null
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          notes: string | null
          credits: number
          hourly_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          user_id?: string | null
          full_name: string
          email: string
          phone?: string | null
          avatar_url?: string | null
          notes?: string | null
          credits?: number
          hourly_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          teacher_id?: string
          user_id?: string | null
          full_name?: string
          email?: string
          phone?: string | null
          avatar_url?: string | null
          notes?: string | null
          credits?: number
          hourly_rate?: number
          updated_at?: string
        }
      }
      parents: {
        Row: {
          id: string
          student_id: string
          full_name: string
          email: string
          phone: string | null
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          full_name: string
          email: string
          phone?: string | null
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          student_id?: string
          full_name?: string
          email?: string
          phone?: string | null
          is_primary?: boolean
        }
      }
      lessons: {
        Row: {
          id: string
          teacher_id: string
          student_id: string
          title: string
          description: string | null
          start_time: string
          end_time: string
          status: LessonStatus
          is_recurring: boolean
          recurrence_pattern: RecurrencePattern | null
          recurrence_end_date: string | null
          parent_lesson_id: string | null
          credits_used: number
          meeting_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          student_id: string
          title: string
          description?: string | null
          start_time: string
          end_time: string
          status?: LessonStatus
          is_recurring?: boolean
          recurrence_pattern?: RecurrencePattern | null
          recurrence_end_date?: string | null
          parent_lesson_id?: string | null
          credits_used?: number
          meeting_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          teacher_id?: string
          student_id?: string
          title?: string
          description?: string | null
          start_time?: string
          end_time?: string
          status?: LessonStatus
          is_recurring?: boolean
          recurrence_pattern?: RecurrencePattern | null
          recurrence_end_date?: string | null
          parent_lesson_id?: string | null
          credits_used?: number
          meeting_url?: string | null
          updated_at?: string
        }
      }
      lesson_students: {
        Row: {
          lesson_id: string
          student_id: string
          created_at: string
        }
        Insert: {
          lesson_id: string
          student_id: string
          created_at?: string
        }
        Update: {
          lesson_id?: string
          student_id?: string
          created_at?: string
        }
      }
      lesson_notes: {
        Row: {
          id: string
          lesson_id: string
          teacher_id: string
          content: string
          is_visible_to_student: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          teacher_id: string
          content: string
          is_visible_to_student?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          lesson_id?: string
          teacher_id?: string
          content?: string
          is_visible_to_student?: boolean
          updated_at?: string
        }
      }
      lesson_templates: {
        Row: {
          id: string
          teacher_id: string
          title: string
          description: string | null
          duration_minutes: number
          default_materials: string[]
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          title: string
          description?: string | null
          duration_minutes?: number
          default_materials?: string[]
          created_at?: string
        }
        Update: {
          teacher_id?: string
          title?: string
          description?: string | null
          duration_minutes?: number
          default_materials?: string[]
        }
      }
      availability_blocks: {
        Row: {
          id: string
          teacher_id: string
          day_of_week: number | null
          start_time: string
          end_time: string
          is_recurring: boolean
          specific_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          day_of_week?: number | null
          start_time: string
          end_time: string
          is_recurring?: boolean
          specific_date?: string | null
          created_at?: string
        }
        Update: {
          teacher_id?: string
          day_of_week?: number | null
          start_time?: string
          end_time?: string
          is_recurring?: boolean
          specific_date?: string | null
        }
      }
      homework: {
        Row: {
          id: string
          teacher_id: string
          student_id: string
          lesson_id: string | null
          title: string
          description: string | null
          due_date: string
          status: HomeworkStatus
          completed_at: string | null
          first_submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          student_id: string
          lesson_id?: string | null
          title: string
          description?: string | null
          due_date: string
          status?: HomeworkStatus
          completed_at?: string | null
          first_submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          teacher_id?: string
          student_id?: string
          lesson_id?: string | null
          title?: string
          description?: string | null
          due_date?: string
          status?: HomeworkStatus
          completed_at?: string | null
          first_submitted_at?: string | null
          updated_at?: string
        }
      }
      homework_submissions: {
        Row: {
          id: string
          homework_id: string
          student_id: string
          content: string | null
          file_urls: string[]
          file_paths: string[]
          original_filenames: string[]
          feedback: string | null
          grade: string | null
          submitted_at: string
          reviewed_at: string | null
          revision_requested_at: string | null
          revision_requested_by: string | null
          reviewed_by: string | null
          accepted_at: string | null
          accepted_by: string | null
          attempt: number
          is_latest: boolean
        }
        Insert: {
          id?: string
          homework_id: string
          student_id: string
          content?: string | null
          file_urls?: string[]
          file_paths?: string[]
          original_filenames?: string[]
          feedback?: string | null
          grade?: string | null
          submitted_at?: string
          reviewed_at?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          reviewed_by?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          attempt?: number
          is_latest?: boolean
        }
        Update: {
          homework_id?: string
          student_id?: string
          content?: string | null
          file_urls?: string[]
          file_paths?: string[]
          original_filenames?: string[]
          feedback?: string | null
          grade?: string | null
          reviewed_at?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          reviewed_by?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          attempt?: number
          is_latest?: boolean
        }
      }
      materials: {
        Row: {
          id: string
          teacher_id: string
          title: string
          description: string | null
          type: string
          file_url: string | null
          external_url: string | null
          tags: string[]
          folder: string | null
          content: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          title: string
          description?: string | null
          type: string
          file_url?: string | null
          external_url?: string | null
          tags?: string[]
          folder?: string | null
          content?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          teacher_id?: string
          title?: string
          description?: string | null
          type?: string
          file_url?: string | null
          external_url?: string | null
          tags?: string[]
          folder?: string | null
          content?: Json | null
          updated_at?: string
        }
      }
      lesson_materials: {
        Row: {
          id: string
          lesson_id: string
          material_id: string
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          material_id: string
          created_at?: string
        }
        Update: {
          lesson_id?: string
          material_id?: string
        }
      }
      homework_materials: {
        Row: {
          id: string
          homework_id: string
          material_id: string
          created_at: string
        }
        Insert: {
          id?: string
          homework_id: string
          material_id: string
          created_at?: string
        }
        Update: {
          homework_id?: string
          material_id?: string
        }
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          recipient_id: string | null
          thread_id: string
          content: string
          file_url: string | null
          is_read: boolean
          created_at: string
          lesson_id: string | null
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_id?: string | null
          thread_id: string
          content: string
          file_url?: string | null
          is_read?: boolean
          created_at?: string
          lesson_id?: string | null
        }
        Update: {
          sender_id?: string
          recipient_id?: string | null
          thread_id?: string
          content?: string
          file_url?: string | null
          is_read?: boolean
          lesson_id?: string | null
        }
      }
      message_threads: {
        Row: {
          id: string
          participant_ids: string[]
          last_message_at: string
          created_at: string
          lesson_id: string | null
        }
        Insert: {
          id?: string
          participant_ids: string[]
          last_message_at?: string
          created_at?: string
          lesson_id?: string | null
        }
        Update: {
          participant_ids?: string[]
          last_message_at?: string
          lesson_id?: string | null
        }
      }
      packages: {
        Row: {
          id: string
          teacher_id: string
          name: string
          description: string | null
          credits: number
          price: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          name: string
          description?: string | null
          credits: number
          price: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          teacher_id?: string
          name?: string
          description?: string | null
          credits?: number
          price?: number
          is_active?: boolean
        }
      }
      payments: {
        Row: {
          id: string
          teacher_id: string
          student_id: string
          package_id: string | null
          amount: number
          credits_purchased: number
          status: string
          payment_method: string | null
          transaction_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          student_id: string
          package_id?: string | null
          amount: number
          credits_purchased: number
          status?: string
          payment_method?: string | null
          transaction_id?: string | null
          created_at?: string
        }
        Update: {
          teacher_id?: string
          student_id?: string
          package_id?: string | null
          amount?: number
          credits_purchased?: number
          status?: string
          payment_method?: string | null
          transaction_id?: string | null
        }
      }
      credit_ledger: {
        Row: {
          id: string
          student_id: string
          teacher_id: string
          amount: number
          balance_after: number
          description: string
          lesson_id: string | null
          payment_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          teacher_id: string
          amount: number
          balance_after: number
          description: string
          lesson_id?: string | null
          payment_id?: string | null
          created_at?: string
        }
        Update: {
          student_id?: string
          teacher_id?: string
          amount?: number
          balance_after?: number
          description?: string
          lesson_id?: string | null
          payment_id?: string | null
        }
      }
      automation_rules: {
        Row: {
          id: string
          teacher_id: string
          type: string
          is_enabled: boolean
          trigger_hours_before: number | null
          message_template: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          type: string
          is_enabled?: boolean
          trigger_hours_before?: number | null
          message_template?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          teacher_id?: string
          type?: string
          is_enabled?: boolean
          trigger_hours_before?: number | null
          message_template?: string | null
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          is_read: boolean
          data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          is_read?: boolean
          data?: Json | null
          created_at?: string
        }
        Update: {
          user_id?: string
          type?: string
          title?: string
          message?: string
          is_read?: boolean
          data?: Json | null
        }
      }
      teacher_settings: {
        Row: {
          id: string
          teacher_id: string
          cancellation_policy_hours: number
          default_lesson_duration: number
          booking_buffer_hours: number
          max_advance_booking_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          cancellation_policy_hours?: number
          default_lesson_duration?: number
          booking_buffer_hours?: number
          max_advance_booking_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          teacher_id?: string
          cancellation_policy_hours?: number
          default_lesson_duration?: number
          booking_buffer_hours?: number
          max_advance_booking_days?: number
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      lesson_status: LessonStatus
      homework_status: HomeworkStatus
      recurrence_pattern: RecurrencePattern
    }
  }
}

// Helper types for easier access
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Student = Database['public']['Tables']['students']['Row']
export type Parent = Database['public']['Tables']['parents']['Row']
export type Lesson = Database['public']['Tables']['lessons']['Row']
export type LessonStudent = Database['public']['Tables']['lesson_students']['Row']
export type LessonNote = Database['public']['Tables']['lesson_notes']['Row']
export type LessonTemplate = Database['public']['Tables']['lesson_templates']['Row']
export type AvailabilityBlock = Database['public']['Tables']['availability_blocks']['Row']
export type Homework = Database['public']['Tables']['homework']['Row']
export type HomeworkSubmission = Database['public']['Tables']['homework_submissions']['Row']
export type Material = Database['public']['Tables']['materials']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type MessageThread = Database['public']['Tables']['message_threads']['Row']
export type Package = Database['public']['Tables']['packages']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type CreditLedger = Database['public']['Tables']['credit_ledger']['Row']
export type AutomationRule = Database['public']['Tables']['automation_rules']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type TeacherSettings = Database['public']['Tables']['teacher_settings']['Row']

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type StudentInsert = Database['public']['Tables']['students']['Insert']
export type LessonInsert = Database['public']['Tables']['lessons']['Insert']
export type LessonStudentInsert = Database['public']['Tables']['lesson_students']['Insert']
export type HomeworkInsert = Database['public']['Tables']['homework']['Insert']
export type MaterialInsert = Database['public']['Tables']['materials']['Insert']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']

// Lesson with student info for calendar/lists
export type LessonWithStudent = Lesson & {
  student: Pick<Student, 'id' | 'full_name' | 'avatar_url' | 'email'>
}

// Student with parent info
export type StudentWithParents = Student & {
  parents: Parent[]
}

