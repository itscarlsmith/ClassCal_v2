import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkLessonOverlap } from '@/lib/lessons-server'
import type { LessonStatus } from '@/types/database'

type Action = 'accept' | 'decline' | 'cancel'

interface StatusRequestBody {
  action: Action
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

type NotificationEventInsert = {
  user_id: string
  notification_type: 'lesson_accepted_or_denied_by_student' | 'lesson_changed'
  event_key: string
  source_type: 'lesson'
  source_id: string
  role: 'teacher' | 'student'
  priority: number
  payload: Record<string, unknown>
}

async function insertNotificationEvents(serviceSupabase: ServiceClient, events: NotificationEventInsert[]) {
  if (!events.length) return
  const { error } = await serviceSupabase.from('notification_events').insert(events)
  if (error) {
    console.error('Failed to insert notification events', error)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params

    const body = (await request.json()) as StatusRequestBody
    const action = body.action

    if (!['accept', 'decline', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const supabase = await createClient()
    const serviceSupabase = await createServiceClient()

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Load lesson (service client) and verify the authenticated user is the primary student
    const { data: lesson, error: lessonError } = await serviceSupabase
      .from('lessons')
      .select('id, status, start_time, end_time, teacher_id, student_id')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      )
    }

    const { data: studentIdsForUserRows, error: studentIdsError } = await serviceSupabase
      .from('students')
      .select('id')
      .eq('user_id', userData.user.id)

    if (studentIdsError) {
      console.error('Error fetching student ids for user', studentIdsError)
      return NextResponse.json({ error: 'Failed to verify student context' }, { status: 500 })
    }

    const studentIdsForUser = (studentIdsForUserRows || []).map((row) => row.id)
    if (studentIdsForUser.length === 0) {
      return NextResponse.json({ error: 'Lesson not found for this student' }, { status: 404 })
    }

    const isPrimaryParticipant = studentIdsForUser.includes(lesson.student_id)
    if (!isPrimaryParticipant) {
      return NextResponse.json({ error: 'Lesson not found for this student' }, { status: 404 })
    }

    const now = new Date()
    const lessonStart = new Date(lesson.start_time)

    if (!(lessonStart instanceof Date) || Number.isNaN(lessonStart.getTime())) {
      return NextResponse.json(
        { error: 'Invalid lesson start time' },
        { status: 500 }
      )
    }

    // Future-only guard
    if (lessonStart <= now) {
      return NextResponse.json(
        { error: 'Only future lessons can be updated.' },
        { status: 409 }
      )
    }

    let newStatus: LessonStatus | null = null

    if (action === 'accept') {
      if (lesson.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only pending lessons can be accepted.' },
          { status: 409 }
        )
      }

      const { hasConflict, error: overlapError } = await checkLessonOverlap({
        supabase: serviceSupabase,
        teacherId: lesson.teacher_id,
        studentIds: studentIdsForUser,
        start: new Date(lesson.start_time),
        end: new Date(lesson.end_time),
        excludeLessonId: lesson.id,
      })

      if (overlapError) {
        console.error('Overlap check failed', overlapError)
        return NextResponse.json(
          { error: 'Failed to verify availability.' },
          { status: 500 }
        )
      }

      if (hasConflict) {
        return NextResponse.json(
          { error: 'You already have a lesson at this time. Please pick another slot.' },
          { status: 409 }
        )
      }

      newStatus = 'confirmed'
    } else if (action === 'decline') {
      if (lesson.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only pending lessons can be declined.' },
          { status: 409 }
        )
      }
      newStatus = 'cancelled'
    } else if (action === 'cancel') {
      if (lesson.status !== 'confirmed') {
        return NextResponse.json(
          { error: 'Only confirmed lessons can be cancelled.' },
          { status: 409 }
        )
      }
      newStatus = 'cancelled'
    }

    if (!newStatus) {
      return NextResponse.json(
        { error: 'Unsupported action for this lesson.' },
        { status: 400 }
      )
    }

    const { data: updatedLesson, error: updateError } = await serviceSupabase
      .from('lessons')
      .update({
        status: newStatus,
      })
      .eq('id', lessonId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating lesson status', updateError)
      return NextResponse.json(
        { error: 'Failed to update lesson.' },
        { status: 500 }
      )
    }

    const { data: studentRow } = await serviceSupabase
      .from('students')
      .select('id, user_id, full_name')
      .eq('id', lesson.student_id)
      .single()

    const { data: teacherProfile } = await serviceSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', lesson.teacher_id)
      .single()

    const teacherName = teacherProfile?.full_name || 'your teacher'
    const studentName = studentRow?.full_name || 'your student'
    const events: NotificationEventInsert[] = []

    if (action === 'accept' || action === 'decline') {
      const variant = action === 'accept' ? 'accepted' : 'denied'
      const title = action === 'accept' ? 'Lesson accepted' : 'Lesson declined'
      const message = `Lesson with ${studentName} was ${variant}.`

      events.push({
        user_id: lesson.teacher_id,
        notification_type: 'lesson_accepted_or_denied_by_student',
        event_key: `lesson:${lessonId}:student_response:${variant}:${updatedLesson.updated_at ?? new Date().toISOString()}`,
        source_type: 'lesson',
        source_id: lessonId,
        role: 'teacher',
        priority: 3,
        payload: {
          href: `/teacher/lessons?lesson=${lessonId}`,
          title,
          message,
          email_subject: title,
          email_body: message,
          lesson_id: lessonId,
          start_time: updatedLesson.start_time,
          end_time: updatedLesson.end_time,
          variant,
        },
      })
    }

    if (newStatus === 'cancelled') {
      const eventKey = `lesson:${lessonId}:changed:cancelled:${updatedLesson.updated_at ?? new Date().toISOString()}`
      const teacherTitle = 'Lesson cancelled'
      const teacherMessage = `Lesson with ${studentName} was canceled.`
      const studentTitle = 'Lesson cancelled'
      const studentMessage = `Lesson with ${teacherName} was canceled.`

      events.push({
        user_id: lesson.teacher_id,
        notification_type: 'lesson_changed',
        event_key: eventKey,
        source_type: 'lesson',
        source_id: lessonId,
        role: 'teacher',
        priority: 3,
        payload: {
          href: `/teacher/lessons?lesson=${lessonId}`,
          title: teacherTitle,
          message: teacherMessage,
          email_subject: teacherTitle,
          email_body: teacherMessage,
          lesson_id: lessonId,
          start_time: updatedLesson.start_time,
          end_time: updatedLesson.end_time,
          variant: 'cancelled',
        },
      })

      if (studentRow?.user_id) {
        events.push({
          user_id: studentRow.user_id,
          notification_type: 'lesson_changed',
          event_key: eventKey,
          source_type: 'lesson',
          source_id: lessonId,
          role: 'student',
          priority: 3,
          payload: {
            href: `/student/lessons?lesson=${lessonId}`,
            title: studentTitle,
            message: studentMessage,
            email_subject: studentTitle,
            email_body: studentMessage,
            lesson_id: lessonId,
            start_time: updatedLesson.start_time,
            end_time: updatedLesson.end_time,
            variant: 'cancelled',
          },
        })
      }
    }

    await insertNotificationEvents(serviceSupabase, events)

    return NextResponse.json({
      lesson: updatedLesson,
    })
  } catch (error) {
    console.error('Error in POST /api/student/lessons/[id]/status', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

