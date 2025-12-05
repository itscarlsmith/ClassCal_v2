-- ClassCal Initial Schema
-- This migration creates all tables, enums, and RLS policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types/enums
CREATE TYPE user_role AS ENUM ('teacher', 'student', 'parent');
CREATE TYPE lesson_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE homework_status AS ENUM ('assigned', 'submitted', 'reviewed', 'overdue');
CREATE TYPE recurrence_pattern AS ENUM ('once', 'daily', 'weekly', 'biweekly', 'monthly');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'student',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Students table (students managed by teachers)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Links to actual user account if they have one
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  notes TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parents table
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lessons table
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status lesson_status NOT NULL DEFAULT 'pending',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_pattern recurrence_pattern,
  recurrence_end_date DATE,
  parent_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  credits_used INTEGER NOT NULL DEFAULT 1,
  meeting_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Lesson notes
CREATE TABLE lesson_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_visible_to_student BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lesson templates
CREATE TABLE lesson_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  default_materials UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Availability blocks
CREATE TABLE availability_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  specific_date DATE, -- For one-time availability
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_availability_time CHECK (end_time > start_time)
);

-- Homework
CREATE TABLE homework (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  status homework_status NOT NULL DEFAULT 'assigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Homework submissions
CREATE TABLE homework_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content TEXT,
  file_urls TEXT[] DEFAULT '{}',
  feedback TEXT,
  grade TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Materials library
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'pdf', 'video', 'link', 'flashcard', 'quiz', 'worksheet'
  file_url TEXT,
  external_url TEXT,
  tags TEXT[] DEFAULT '{}',
  folder TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lesson materials junction
CREATE TABLE lesson_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lesson_id, material_id)
);

-- Message threads
CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_ids UUID[] NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  file_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Packages (lesson bundles)
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  credits_purchased INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit ledger
CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for credits added, negative for credits used
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automation rules
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'lesson_reminder', 'homework_reminder', 'payment_reminder'
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_hours_before INTEGER,
  message_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teacher settings
CREATE TABLE teacher_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  cancellation_policy_hours INTEGER NOT NULL DEFAULT 24,
  default_lesson_duration INTEGER NOT NULL DEFAULT 60,
  booking_buffer_hours INTEGER NOT NULL DEFAULT 2,
  max_advance_booking_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_students_teacher ON students(teacher_id);
CREATE INDEX idx_lessons_teacher ON lessons(teacher_id);
CREATE INDEX idx_lessons_student ON lessons(student_id);
CREATE INDEX idx_lessons_start_time ON lessons(start_time);
CREATE INDEX idx_lessons_status ON lessons(status);
CREATE INDEX idx_homework_teacher ON homework(teacher_id);
CREATE INDEX idx_homework_student ON homework(student_id);
CREATE INDEX idx_homework_status ON homework(status);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_availability_teacher ON availability_blocks(teacher_id);
CREATE INDEX idx_credit_ledger_student ON credit_ledger(student_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Students: Teachers can manage their students, students can view themselves
CREATE POLICY "Teachers can view their students" ON students FOR SELECT 
  USING (teacher_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "Teachers can insert students" ON students FOR INSERT 
  WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update their students" ON students FOR UPDATE 
  USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete their students" ON students FOR DELETE 
  USING (teacher_id = auth.uid());

-- Parents: Teachers can manage, linked students can view
CREATE POLICY "Teachers can view parents" ON parents FOR SELECT 
  USING (EXISTS (SELECT 1 FROM students WHERE students.id = parents.student_id AND students.teacher_id = auth.uid()));
CREATE POLICY "Teachers can insert parents" ON parents FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = parents.student_id AND students.teacher_id = auth.uid()));
CREATE POLICY "Teachers can update parents" ON parents FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM students WHERE students.id = parents.student_id AND students.teacher_id = auth.uid()));
CREATE POLICY "Teachers can delete parents" ON parents FOR DELETE 
  USING (EXISTS (SELECT 1 FROM students WHERE students.id = parents.student_id AND students.teacher_id = auth.uid()));

-- Lessons: Teachers manage, students view their own
CREATE POLICY "Teachers can view their lessons" ON lessons FOR SELECT 
  USING (teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM students WHERE students.id = lessons.student_id AND students.user_id = auth.uid()));
CREATE POLICY "Teachers can insert lessons" ON lessons FOR INSERT 
  WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update lessons" ON lessons FOR UPDATE 
  USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete lessons" ON lessons FOR DELETE 
  USING (teacher_id = auth.uid());

-- Lesson notes: Teachers manage, visible notes viewable by students
CREATE POLICY "View lesson notes" ON lesson_notes FOR SELECT 
  USING (teacher_id = auth.uid() OR (is_visible_to_student AND EXISTS (
    SELECT 1 FROM lessons l JOIN students s ON l.student_id = s.id 
    WHERE l.id = lesson_notes.lesson_id AND s.user_id = auth.uid()
  )));
CREATE POLICY "Teachers can insert lesson notes" ON lesson_notes FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update lesson notes" ON lesson_notes FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete lesson notes" ON lesson_notes FOR DELETE USING (teacher_id = auth.uid());

-- Lesson templates: Teachers only
CREATE POLICY "Teachers can view own templates" ON lesson_templates FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can insert templates" ON lesson_templates FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update templates" ON lesson_templates FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete templates" ON lesson_templates FOR DELETE USING (teacher_id = auth.uid());

-- Availability: Teachers manage, students can view for booking
CREATE POLICY "View availability" ON availability_blocks FOR SELECT 
  USING (teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM students WHERE students.teacher_id = availability_blocks.teacher_id AND students.user_id = auth.uid()));
CREATE POLICY "Teachers can insert availability" ON availability_blocks FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update availability" ON availability_blocks FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete availability" ON availability_blocks FOR DELETE USING (teacher_id = auth.uid());

-- Homework: Teachers manage, students view their own
CREATE POLICY "View homework" ON homework FOR SELECT 
  USING (teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM students WHERE students.id = homework.student_id AND students.user_id = auth.uid()));
CREATE POLICY "Teachers can insert homework" ON homework FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update homework" ON homework FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete homework" ON homework FOR DELETE USING (teacher_id = auth.uid());

-- Homework submissions: Students submit, teachers view
CREATE POLICY "View submissions" ON homework_submissions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM homework h WHERE h.id = homework_submissions.homework_id AND h.teacher_id = auth.uid()) OR 
         EXISTS (SELECT 1 FROM students WHERE students.id = homework_submissions.student_id AND students.user_id = auth.uid()));
CREATE POLICY "Students can submit" ON homework_submissions FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = homework_submissions.student_id AND students.user_id = auth.uid()));
CREATE POLICY "Update submissions" ON homework_submissions FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM homework h WHERE h.id = homework_submissions.homework_id AND h.teacher_id = auth.uid()) OR 
         EXISTS (SELECT 1 FROM students WHERE students.id = homework_submissions.student_id AND students.user_id = auth.uid()));

-- Materials: Teachers only
CREATE POLICY "Teachers can view own materials" ON materials FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can insert materials" ON materials FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update materials" ON materials FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete materials" ON materials FOR DELETE USING (teacher_id = auth.uid());

-- Lesson materials: Follow lesson permissions
CREATE POLICY "View lesson materials" ON lesson_materials FOR SELECT 
  USING (EXISTS (SELECT 1 FROM lessons WHERE lessons.id = lesson_materials.lesson_id AND lessons.teacher_id = auth.uid()));
CREATE POLICY "Teachers can manage lesson materials" ON lesson_materials FOR ALL 
  USING (EXISTS (SELECT 1 FROM lessons WHERE lessons.id = lesson_materials.lesson_id AND lessons.teacher_id = auth.uid()));

-- Message threads: Participants only
CREATE POLICY "View own threads" ON message_threads FOR SELECT USING (auth.uid() = ANY(participant_ids));
CREATE POLICY "Create threads" ON message_threads FOR INSERT WITH CHECK (auth.uid() = ANY(participant_ids));
CREATE POLICY "Update threads" ON message_threads FOR UPDATE USING (auth.uid() = ANY(participant_ids));

-- Messages: Sender or recipient
CREATE POLICY "View own messages" ON messages FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "Send messages" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Update own messages" ON messages FOR UPDATE USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Packages: Teachers manage, students can view active ones
CREATE POLICY "View packages" ON packages FOR SELECT 
  USING (teacher_id = auth.uid() OR (is_active AND EXISTS (SELECT 1 FROM students WHERE students.teacher_id = packages.teacher_id AND students.user_id = auth.uid())));
CREATE POLICY "Teachers can insert packages" ON packages FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update packages" ON packages FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete packages" ON packages FOR DELETE USING (teacher_id = auth.uid());

-- Payments: Teachers manage, students view their own
CREATE POLICY "View payments" ON payments FOR SELECT 
  USING (teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM students WHERE students.id = payments.student_id AND students.user_id = auth.uid()));
CREATE POLICY "Teachers can insert payments" ON payments FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update payments" ON payments FOR UPDATE USING (teacher_id = auth.uid());

-- Credit ledger: Teachers and students view relevant entries
CREATE POLICY "View credit ledger" ON credit_ledger FOR SELECT 
  USING (teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM students WHERE students.id = credit_ledger.student_id AND students.user_id = auth.uid()));
CREATE POLICY "Teachers can insert credit entries" ON credit_ledger FOR INSERT WITH CHECK (teacher_id = auth.uid());

-- Automation rules: Teachers only
CREATE POLICY "Teachers can view own rules" ON automation_rules FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can insert rules" ON automation_rules FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update rules" ON automation_rules FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete rules" ON automation_rules FOR DELETE USING (teacher_id = auth.uid());

-- Notifications: Users view own only
CREATE POLICY "View own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Teacher settings: Teachers only
CREATE POLICY "Teachers can view own settings" ON teacher_settings FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can insert settings" ON teacher_settings FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update settings" ON teacher_settings FOR UPDATE USING (teacher_id = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lesson_notes_updated_at BEFORE UPDATE ON lesson_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_homework_updated_at BEFORE UPDATE ON homework FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teacher_settings_updated_at BEFORE UPDATE ON teacher_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to deduct credit after lesson completion
CREATE OR REPLACE FUNCTION deduct_lesson_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update student credits
    UPDATE students 
    SET credits = credits - NEW.credits_used 
    WHERE id = NEW.student_id;
    
    -- Record in ledger
    INSERT INTO credit_ledger (student_id, teacher_id, amount, balance_after, description, lesson_id)
    SELECT 
      NEW.student_id, 
      NEW.teacher_id, 
      -NEW.credits_used,
      s.credits - NEW.credits_used,
      'Lesson completed: ' || NEW.title,
      NEW.id
    FROM students s WHERE s.id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_lesson_completed
  AFTER UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION deduct_lesson_credit();

