-- ClassCal Demo Seed Data
-- This file creates demo accounts and populates them with sample data

-- Note: This seed file assumes you've already run the migrations
-- and have created demo users via Supabase Auth

-- Demo teacher account: teacher@classcal.demo / ClassCal2024!
-- Demo student account: student@classcal.demo / ClassCal2024!

-- We'll use fixed UUIDs for demo accounts to make seeding predictable
-- In production, you'd create these users via Supabase Auth first

-- Demo Teacher Profile (UUID: 35ff8d14-a647-401c-992c-a4e01ae34f14)
INSERT INTO profiles (id, email, full_name, role, timezone, avatar_url) VALUES
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 'teacher@classcal.demo', 'Sarah Mitchell', 'teacher', 'America/New_York', NULL)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Demo Student Profile (UUID: e08da009-b509-4fbf-9207-58651d9569fb)
INSERT INTO profiles (id, email, full_name, role, timezone, avatar_url) VALUES
  ('e08da009-b509-4fbf-9207-58651d9569fb', 'student@classcal.demo', 'Alex Johnson', 'student', 'America/New_York', NULL)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Teacher settings
INSERT INTO teacher_settings (teacher_id, cancellation_policy_hours, default_lesson_duration, booking_buffer_hours, max_advance_booking_days) VALUES
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 24, 60, 2, 30)
ON CONFLICT (teacher_id) DO NOTHING;

-- Students for the teacher (including the demo student account)
INSERT INTO students (id, teacher_id, user_id, full_name, email, phone, credits, hourly_rate, notes) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'e08da009-b509-4fbf-9207-58651d9569fb', 'Alex Johnson', 'student@classcal.demo', '+1 555-0101', 8, 45.00, 'Intermediate level. Working on conversation skills.'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '35ff8d14-a647-401c-992c-a4e01ae34f14', NULL, 'Emma Williams', 'emma.williams@example.com', '+1 555-0102', 5, 45.00, 'Beginner. Focus on grammar fundamentals.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '35ff8d14-a647-401c-992c-a4e01ae34f14', NULL, 'Michael Chen', 'michael.chen@example.com', '+1 555-0103', 12, 50.00, 'Advanced. Preparing for business presentations.'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '35ff8d14-a647-401c-992c-a4e01ae34f14', NULL, 'Sofia Rodriguez', 'sofia.rodriguez@example.com', '+1 555-0104', 3, 45.00, 'Intermediate. Working on pronunciation.'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '35ff8d14-a647-401c-992c-a4e01ae34f14', NULL, 'James Wilson', 'james.wilson@example.com', '+1 555-0105', 0, 45.00, 'Beginner. Needs to purchase more credits.')
ON CONFLICT (id) DO NOTHING;

-- Parents for child student
INSERT INTO parents (id, student_id, full_name, email, phone, is_primary) VALUES
  ('pppppppp-pppp-pppp-pppp-pppppppppppp', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Maria Rodriguez', 'maria.rodriguez@example.com', '+1 555-0204', true)
ON CONFLICT (id) DO NOTHING;

-- Teacher availability (recurring weekly)
INSERT INTO availability_blocks (teacher_id, day_of_week, start_time, end_time, is_recurring) VALUES
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 1, '09:00', '17:00', true), -- Monday
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 2, '09:00', '17:00', true), -- Tuesday
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 3, '09:00', '17:00', true), -- Wednesday
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 4, '09:00', '17:00', true), -- Thursday
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 5, '09:00', '14:00', true); -- Friday (half day)

-- Lessons (mix of upcoming, past, and various statuses)
-- Using relative dates from 'now'
INSERT INTO lessons (id, teacher_id, student_id, title, description, start_time, end_time, status, credits_used) VALUES
  -- Past completed lessons
  ('11111111-aaaa-aaaa-aaaa-111111111111', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'Conversation Practice', 'Review of travel vocabulary and role-playing scenarios', 
   NOW() - INTERVAL '7 days' + TIME '10:00', NOW() - INTERVAL '7 days' + TIME '11:00', 'completed', 1),
  
  ('22222222-aaaa-aaaa-aaaa-222222222222', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   'Grammar Basics', 'Present tense conjugations', 
   NOW() - INTERVAL '5 days' + TIME '14:00', NOW() - INTERVAL '5 days' + TIME '15:00', 'completed', 1),
  
  ('33333333-aaaa-aaaa-aaaa-333333333333', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
   'Business English', 'Email writing and formal communication', 
   NOW() - INTERVAL '3 days' + TIME '11:00', NOW() - INTERVAL '3 days' + TIME '12:00', 'completed', 1),

  -- Today's lessons
  ('44444444-aaaa-aaaa-aaaa-444444444444', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'Listening Comprehension', 'Practice with native speaker recordings', 
   NOW()::DATE + TIME '15:00', NOW()::DATE + TIME '16:00', 'confirmed', 1),

  -- Upcoming lessons
  ('55555555-aaaa-aaaa-aaaa-555555555555', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
   'Presentation Skills', 'Mock presentation and feedback', 
   NOW() + INTERVAL '1 day' + TIME '10:00', NOW() + INTERVAL '1 day' + TIME '11:30', 'confirmed', 1),

  ('66666666-aaaa-aaaa-aaaa-666666666666', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   'Vocabulary Building', 'Food and restaurant vocabulary', 
   NOW() + INTERVAL '2 days' + TIME '14:00', NOW() + INTERVAL '2 days' + TIME '15:00', 'pending', 1),

  ('77777777-aaaa-aaaa-aaaa-777777777777', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 
   'Pronunciation Workshop', 'Difficult sounds practice', 
   NOW() + INTERVAL '3 days' + TIME '16:00', NOW() + INTERVAL '3 days' + TIME '17:00', 'confirmed', 1),

  ('88888888-aaaa-aaaa-aaaa-888888888888', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'Reading Comprehension', 'News article analysis', 
   NOW() + INTERVAL '5 days' + TIME '10:00', NOW() + INTERVAL '5 days' + TIME '11:00', 'pending', 1),

  -- Cancelled lesson example
  ('99999999-aaaa-aaaa-aaaa-999999999999', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 
   'Introduction Lesson', 'Initial assessment', 
   NOW() - INTERVAL '2 days' + TIME '09:00', NOW() - INTERVAL '2 days' + TIME '10:00', 'cancelled', 0)
ON CONFLICT (id) DO NOTHING;

-- Lesson notes
INSERT INTO lesson_notes (lesson_id, teacher_id, content, is_visible_to_student) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Great progress on travel vocabulary! Alex is becoming more confident with spontaneous conversation. Next focus: past tense usage in travel contexts.', true),
  ('22222222-aaaa-aaaa-aaaa-222222222222', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Emma is grasping the basics well. Some confusion with irregular verbs - need more practice exercises.', true),
  ('33333333-aaaa-aaaa-aaaa-333333333333', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Michael wrote excellent formal emails. Ready to move on to phone call scenarios.', true);

-- Lesson templates
INSERT INTO lesson_templates (id, teacher_id, title, description, duration_minutes) VALUES
  ('tttttttt-0001-tttt-tttt-tttttttttttt', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'Standard 1-Hour Lesson', 'Regular lesson with warm-up, main activity, and review', 60),
  ('tttttttt-0002-tttt-tttt-tttttttttttt', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'Intensive 90-Minute Session', 'Extended lesson for deeper practice', 90),
  ('tttttttt-0003-tttt-tttt-tttt-tttttttt', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'Quick 30-Minute Check-in', 'Short session for review or specific questions', 30)
ON CONFLICT (id) DO NOTHING;

-- Homework assignments
INSERT INTO homework (id, teacher_id, student_id, lesson_id, title, description, due_date, status) VALUES
  -- Assigned homework
  ('hhhhhhhh-0001-hhhh-hhhh-hhhhhhhhhhhh', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-aaaa-aaaa-111111111111',
   'Travel Vocabulary Exercises', 'Complete the worksheet on travel phrases. Write 5 sentences using each new vocabulary word.',
   NOW() + INTERVAL '3 days', 'assigned'),
  
  -- Submitted, awaiting review
  ('hhhhhhhh-0002-hhhh-hhhh-hhhhhhhhhhhh', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-aaaa-aaaa-aaaa-222222222222',
   'Verb Conjugation Practice', 'Conjugate the following 20 verbs in present tense.',
   NOW() - INTERVAL '1 day', 'submitted'),

  -- Reviewed
  ('hhhhhhhh-0003-hhhh-hhhh-hhhhhhhhhhhh', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-aaaa-aaaa-aaaa-333333333333',
   'Write a Formal Email', 'Write a formal email requesting a meeting with a potential client.',
   NOW() - INTERVAL '5 days', 'reviewed'),

  -- Overdue
  ('hhhhhhhh-0004-hhhh-hhhh-hhhhhhhhhhhh', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'dddddddd-dddd-dddd-dddd-dddddddddddd', NULL,
   'Pronunciation Recording', 'Record yourself reading the provided passage. Focus on the "th" and "r" sounds.',
   NOW() - INTERVAL '3 days', 'overdue')
ON CONFLICT (id) DO NOTHING;

-- Homework submissions
INSERT INTO homework_submissions (homework_id, student_id, content, feedback, grade, submitted_at, reviewed_at) VALUES
  ('hhhhhhhh-0002-hhhh-hhhh-hhhhhhhhhhhh', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   'Here are my verb conjugations: 1. hablar - hablo, hablas, habla... (continued)', NULL, NULL, NOW() - INTERVAL '2 hours', NULL),
  ('hhhhhhhh-0003-hhhh-hhhh-hhhhhhhhhhhh', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
   'Dear Mr. Smith, I am writing to request a meeting...', 'Excellent work! Very professional tone. Minor suggestion: vary your sentence openers.', 'A', 
   NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days');

-- Materials library
INSERT INTO materials (id, teacher_id, title, description, type, tags, folder) VALUES
  ('mmmmmmmm-0001-mmmm-mmmm-mmmmmmmmmmmm', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Travel Vocabulary Flashcards', 'Essential words and phrases for travelers', 'flashcard', ARRAY['travel', 'vocabulary', 'beginner'], 'Vocabulary'),
  ('mmmmmmmm-0002-mmmm-mmmm-mmmmmmmmmmmm', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Present Tense Worksheet', 'Practice exercises for present tense conjugation', 'worksheet', ARRAY['grammar', 'present tense', 'beginner'], 'Grammar'),
  ('mmmmmmmm-0003-mmmm-mmmm-mmmmmmmmmmmm', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Business Email Templates', 'Collection of formal email examples', 'pdf', ARRAY['business', 'writing', 'advanced'], 'Business'),
  ('mmmmmmmm-0004-mmmm-mmmm-mmmmmmmmmmmm', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Pronunciation Guide Video', 'Video tutorial on difficult sounds', 'video', ARRAY['pronunciation', 'intermediate'], 'Pronunciation'),
  ('mmmmmmmm-0005-mmmm-mmmm-mmmmmmmmmmmm', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Grammar Quiz - Tenses', 'Interactive quiz covering all tenses', 'quiz', ARRAY['grammar', 'quiz', 'intermediate'], 'Quizzes')
ON CONFLICT (id) DO NOTHING;

-- Packages
INSERT INTO packages (id, teacher_id, name, description, credits, price, is_active) VALUES
  ('pkgpkgpk-0001-pkgp-kgpk-gpkgpkgpkgpk', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Single Lesson', 'One 60-minute lesson', 1, 45.00, true),
  ('pkgpkgpk-0002-pkgp-kgpk-gpkgpkgpkgpk', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   '5 Lesson Pack', 'Save 10% with 5 lessons', 5, 202.50, true),
  ('pkgpkgpk-0003-pkgp-kgpk-gpkgpkgpkgpk', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   '10 Lesson Pack', 'Save 15% with 10 lessons', 10, 382.50, true),
  ('pkgpkgpk-0004-pkgp-kgpk-gpkgpkgpkgpk', '35ff8d14-a647-401c-992c-a4e01ae34f14', 
   'Monthly Intensive', '20 lessons - Best value!', 20, 720.00, true)
ON CONFLICT (id) DO NOTHING;

-- Sample payments/transactions
INSERT INTO payments (id, teacher_id, student_id, package_id, amount, credits_purchased, status, payment_method, created_at) VALUES
  ('paypaypa-0001-payp-aypa-ypaypaypaypa', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'pkgpkgpk-0003-pkgp-kgpk-gpkgpkgpkgpk', 382.50, 10, 'completed', 'card', NOW() - INTERVAL '30 days'),
  ('paypaypa-0002-payp-aypa-ypaypaypaypa', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   'pkgpkgpk-0002-pkgp-kgpk-gpkgpkgpkgpk', 202.50, 5, 'completed', 'card', NOW() - INTERVAL '14 days'),
  ('paypaypa-0003-payp-aypa-ypaypaypaypa', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 
   'pkgpkgpk-0004-pkgp-kgpk-gpkgpkgpkgpk', 720.00, 20, 'completed', 'card', NOW() - INTERVAL '45 days')
ON CONFLICT (id) DO NOTHING;

-- Credit ledger entries (for transaction history)
INSERT INTO credit_ledger (student_id, teacher_id, amount, balance_after, description, payment_id, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '35ff8d14-a647-401c-992c-a4e01ae34f14', 10, 10, 'Purchased 10 Lesson Pack', 'paypaypa-0001-payp-aypa-ypaypaypaypa', NOW() - INTERVAL '30 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '35ff8d14-a647-401c-992c-a4e01ae34f14', -1, 9, 'Lesson completed: Conversation Practice', NULL, NOW() - INTERVAL '7 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '35ff8d14-a647-401c-992c-a4e01ae34f14', -1, 8, 'Lesson completed: Previous lesson', NULL, NOW() - INTERVAL '14 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '35ff8d14-a647-401c-992c-a4e01ae34f14', 5, 5, 'Purchased 5 Lesson Pack', 'paypaypa-0002-payp-aypa-ypaypaypaypa', NOW() - INTERVAL '14 days'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '35ff8d14-a647-401c-992c-a4e01ae34f14', 20, 20, 'Purchased Monthly Intensive', 'paypaypa-0003-payp-aypa-ypaypaypaypa', NOW() - INTERVAL '45 days');

-- Message threads
INSERT INTO message_threads (id, participant_ids, last_message_at) VALUES
  ('thrdthrd-0001-thrd-thrd-thrdthrdthrd', ARRAY['35ff8d14-a647-401c-992c-a4e01ae34f14', 'e08da009-b509-4fbf-9207-58651d9569fb']::UUID[], NOW() - INTERVAL '1 hour'),
  ('thrdthrd-0002-thrd-thrd-thrdthrdthrd', ARRAY['35ff8d14-a647-401c-992c-a4e01ae34f14']::UUID[], NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- Messages
INSERT INTO messages (sender_id, recipient_id, thread_id, content, is_read, created_at) VALUES
  ('e08da009-b509-4fbf-9207-58651d9569fb', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'thrdthrd-0001-thrd-thrd-thrdthrdthrd',
   'Hi Sarah! Just wanted to confirm our lesson for today at 3pm.', true, NOW() - INTERVAL '3 hours'),
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 'e08da009-b509-4fbf-9207-58651d9569fb', 'thrdthrd-0001-thrd-thrd-thrdthrdthrd',
   'Hi Alex! Yes, confirmed! See you at 3pm. Please review the travel vocabulary we covered last time.', true, NOW() - INTERVAL '2 hours'),
  ('e08da009-b509-4fbf-9207-58651d9569fb', '35ff8d14-a647-401c-992c-a4e01ae34f14', 'thrdthrd-0001-thrd-thrd-thrdthrdthrd',
   'Will do! Thanks!', true, NOW() - INTERVAL '1 hour');

-- Automation rules
INSERT INTO automation_rules (teacher_id, type, is_enabled, trigger_hours_before, message_template) VALUES
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 'lesson_reminder', true, 24, 'Hi {student_name}! Just a reminder that we have a lesson scheduled for tomorrow at {lesson_time}. See you then!'),
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 'lesson_reminder', true, 1, 'Your lesson starts in 1 hour! Here''s the meeting link: {meeting_url}'),
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 'homework_reminder', true, 24, 'Hi {student_name}! Your homework "{homework_title}" is due tomorrow. Don''t forget to submit it!'),
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 'payment_reminder', false, 72, 'Hi {student_name}! Your lesson credits are running low ({credits_remaining} remaining). Consider purchasing more to continue booking lessons.');

-- Sample notifications
INSERT INTO notifications (user_id, type, title, message, is_read, created_at) VALUES
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 'lesson_confirmed', 'Lesson Confirmed', 'Alex Johnson confirmed the lesson for tomorrow at 3:00 PM', false, NOW() - INTERVAL '30 minutes'),
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 'homework_submitted', 'Homework Submitted', 'Emma Williams submitted "Verb Conjugation Practice"', false, NOW() - INTERVAL '2 hours'),
  ('35ff8d14-a647-401c-992c-a4e01ae34f14', 'payment_received', 'Payment Received', 'Received $382.50 from Alex Johnson for 10 Lesson Pack', true, NOW() - INTERVAL '30 days'),
  ('e08da009-b509-4fbf-9207-58651d9569fb', 'lesson_reminder', 'Upcoming Lesson', 'Reminder: You have a lesson with Sarah Mitchell today at 3:00 PM', false, NOW() - INTERVAL '1 hour');

