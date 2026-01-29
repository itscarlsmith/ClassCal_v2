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
export type NotificationType =
  | 'lesson_upcoming_reminder'
  | 'lesson_changed'
  | 'lesson_scheduled_by_teacher'
  | 'lesson_accepted_or_denied_by_student'
  | 'lesson_booked_by_student'
  | 'homework_assigned'
  | 'homework_due_soon'
  | 'homework_submitted'
  | 'message_received'
  | 'credit_threshold_reached'
export type NotificationSource = 'lesson' | 'homework' | 'message' | 'credits'
export type NotificationRole = 'teacher' | 'student'
export type NotificationEventStatus = 'new' | 'processed' | 'skipped' | 'failed'
export type NotificationEmailStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'canceled'
  | 'skipped'

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
          hourly_rate: number | null
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
          hourly_rate?: number | null
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
          hourly_rate?: number | null
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
          recipient_id: string
          thread_id: string
          content: string
          file_url: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_id: string
          thread_id: string
          content: string
          file_url?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          sender_id?: string
          recipient_id?: string
          thread_id?: string
          content?: string
          file_url?: string | null
          is_read?: boolean
        }
      }
      message_threads: {
        Row: {
          id: string
          participant_ids: string[]
          last_message_at: string
          created_at: string
        }
        Insert: {
          id?: string
          participant_ids: string[]
          last_message_at?: string
          created_at?: string
        }
        Update: {
          participant_ids?: string[]
          last_message_at?: string
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
          stripe_payment_intent_id: string | null
          type: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          teacher_id: string
          amount: number
          balance_after?: number
          description: string
          lesson_id?: string | null
          payment_id?: string | null
          stripe_payment_intent_id?: string | null
          type: string
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
          stripe_payment_intent_id?: string | null
          type?: string
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
          notification_type: NotificationType | null
          source_type: NotificationSource | null
          source_id: string | null
          role: NotificationRole | null
          priority: number
          event_key: string | null
          read_at: string | null
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
          notification_type?: NotificationType | null
          source_type?: NotificationSource | null
          source_id?: string | null
          role?: NotificationRole | null
          priority?: number
          event_key?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          type?: string
          title?: string
          message?: string
          is_read?: boolean
          data?: Json | null
          notification_type?: NotificationType | null
          source_type?: NotificationSource | null
          source_id?: string | null
          role?: NotificationRole | null
          priority?: number
          event_key?: string | null
          read_at?: string | null
        }
      }
      notification_type_catalog: {
        Row: {
          notification_type: NotificationType
          label: string
          category: string
          allowed_roles: NotificationRole[]
          supports_timing: boolean
          supports_thresholds: boolean
          default_in_app_enabled: boolean
          default_email_enabled: boolean
          default_timing_minutes: number[] | null
          default_credit_thresholds: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          notification_type: NotificationType
          label: string
          category: string
          allowed_roles: NotificationRole[]
          supports_timing?: boolean
          supports_thresholds?: boolean
          default_in_app_enabled?: boolean
          default_email_enabled?: boolean
          default_timing_minutes?: number[] | null
          default_credit_thresholds?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          label?: string
          category?: string
          allowed_roles?: NotificationRole[]
          supports_timing?: boolean
          supports_thresholds?: boolean
          default_in_app_enabled?: boolean
          default_email_enabled?: boolean
          default_timing_minutes?: number[] | null
          default_credit_thresholds?: number[] | null
          updated_at?: string
        }
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          notification_type: NotificationType
          in_app_enabled: boolean
          email_enabled: boolean
          timing_minutes: number[] | null
          credit_thresholds: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          notification_type: NotificationType
          in_app_enabled?: boolean
          email_enabled?: boolean
          timing_minutes?: number[] | null
          credit_thresholds?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          notification_type?: NotificationType
          in_app_enabled?: boolean
          email_enabled?: boolean
          timing_minutes?: number[] | null
          credit_thresholds?: number[] | null
          updated_at?: string
        }
      }
      notification_events: {
        Row: {
          id: string
          user_id: string
          notification_type: NotificationType
          event_key: string
          source_type: NotificationSource
          source_id: string | null
          role: NotificationRole
          priority: number
          payload: Json
          status: NotificationEventStatus
          created_at: string
          processed_at: string | null
          last_error: string | null
        }
        Insert: {
          id?: string
          user_id: string
          notification_type: NotificationType
          event_key: string
          source_type: NotificationSource
          source_id?: string | null
          role: NotificationRole
          priority?: number
          payload?: Json
          status?: NotificationEventStatus
          created_at?: string
          processed_at?: string | null
          last_error?: string | null
        }
        Update: {
          user_id?: string
          notification_type?: NotificationType
          event_key?: string
          source_type?: NotificationSource
          source_id?: string | null
          role?: NotificationRole
          priority?: number
          payload?: Json
          status?: NotificationEventStatus
          processed_at?: string | null
          last_error?: string | null
        }
      }
      notification_email_outbox: {
        Row: {
          id: string
          user_id: string
          event_key: string
          notification_type: NotificationType
          source_type: NotificationSource
          source_id: string | null
          role: NotificationRole
          priority: number
          to_email: string
          subject: string
          text_body: string
          cta_url: string
          template_data: Json | null
          scheduled_for: string
          status: NotificationEmailStatus
          attempt_count: number
          last_error: string | null
          sent_at: string | null
          locked_at: string | null
          locked_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_key: string
          notification_type: NotificationType
          source_type: NotificationSource
          source_id?: string | null
          role: NotificationRole
          priority?: number
          to_email: string
          subject: string
          text_body: string
          cta_url: string
          template_data?: Json | null
          scheduled_for?: string
          status?: NotificationEmailStatus
          attempt_count?: number
          last_error?: string | null
          sent_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          event_key?: string
          notification_type?: NotificationType
          source_type?: NotificationSource
          source_id?: string | null
          role?: NotificationRole
          priority?: number
          to_email?: string
          subject?: string
          text_body?: string
          cta_url?: string
          template_data?: Json | null
          scheduled_for?: string
          status?: NotificationEmailStatus
          attempt_count?: number
          last_error?: string | null
          sent_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          updated_at?: string
        }
      }
      notification_dispatch_config: {
        Row: {
          id: number
          dispatch_url: string | null
          dispatch_secret: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          dispatch_url?: string | null
          dispatch_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          dispatch_url?: string | null
          dispatch_secret?: string | null
          updated_at?: string
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
          default_hourly_rate: number
          currency_code: string
          country: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_payouts_enabled: boolean
          stripe_onboarding_completed: boolean
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
          default_hourly_rate?: number
          currency_code?: string
          country?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          stripe_onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          teacher_id?: string
          cancellation_policy_hours?: number
          default_lesson_duration?: number
          booking_buffer_hours?: number
          max_advance_booking_days?: number
          default_hourly_rate?: number
          currency_code?: string
          country?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          stripe_onboarding_completed?: boolean
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
      notification_type: NotificationType
      notification_source: NotificationSource
      notification_role: NotificationRole
      notification_event_status: NotificationEventStatus
      notification_email_status: NotificationEmailStatus
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Student = Database['public']['Tables']['students']['Row']
export type Parent = Database['public']['Tables']['parents']['Row']
export type Lesson = Database['public']['Tables']['lessons']['Row']
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
export type NotificationDispatchConfig =
  Database['public']['Tables']['notification_dispatch_config']['Row']
export type TeacherSettings = Database['public']['Tables']['teacher_settings']['Row']

export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type StudentInsert = Database['public']['Tables']['students']['Insert']
export type LessonInsert = Database['public']['Tables']['lessons']['Insert']
export type HomeworkInsert = Database['public']['Tables']['homework']['Insert']
export type MaterialInsert = Database['public']['Tables']['materials']['Insert']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']

export type LessonWithStudent = Lesson & {
  student: Pick<Student, 'id' | 'full_name' | 'avatar_url' | 'email'>
}

export type StudentWithParents = Student & {
  parents: Parent[]
}
