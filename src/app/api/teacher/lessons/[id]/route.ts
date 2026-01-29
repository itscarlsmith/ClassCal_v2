import { NextResponse } from 'next/server'
import { differenceInMinutes } from 'date-fns'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkLessonOverlap } from '@/lib/lessons-server'
import type { LessonStatus } from '@/types/database'

interface PatchBody {
  start_time?: string
  end_time?: string
  title?: string
  description?: string | null
  status?: LessonStatus
  action?: 'cancel'
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

type NotificationEventInsert = {
  user_id: string
  notification_type: 'lesson_changed'
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params

    const supabase = await createClient()
    const serviceSupabase = await createServiceClient()

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = (await request.json()) as PatchBody

    const { data: lesson, error: lessonError } = await serviceSupabase
      .from('lessons')
      .select('id, teacher_id, student_id, status, start_time, end_time, title, description')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    if (lesson.teacher_id !== userData.user.id) {
      return NextResponse.json({ error: 'Not authorized for this lesson' }, { status: 403 })
    }

    const now = new Date()
    const currentStart = new Date(lesson.start_time)
    const currentEnd = new Date(lesson.end_time)

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

    // Parse incoming times if provided
    const newStart = body.start_time ? new Date(body.start_time) : currentStart
    const newEnd = body.end_time ? new Date(body.end_time) : currentEnd

    const startChanged = body.start_time ? newStart.getTime() !== currentStart.getTime() : false
    const endChanged = body.end_time ? newEnd.getTime() !== currentEnd.getTime() : false
    const timeChanged = startChanged || endChanged

    if (body.start_time && Number.isNaN(newStart.getTime())) {
      return NextResponse.json({ error: 'Invalid start_time' }, { status: 400 })
    }
    if (body.end_time && Number.isNaN(newEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid end_time' }, { status: 400 })
    }

    // Cancellation flow
    if (body.action === 'cancel' || body.status === 'cancelled') {
      if (lesson.status !== 'pending' && lesson.status !== 'confirmed') {
        return NextResponse.json(
          { error: 'Only pending or confirmed lessons can be cancelled.' },
          { status: 409 }
        )
      }
      if (currentStart <= now) {
        return NextResponse.json(
          { error: 'Only future lessons can be cancelled.' },
          { status: 409 }
        )
      }

      const { data: cancelledLesson, error: cancelError } = await serviceSupabase
        .from('lessons')
        .update({
          status: 'cancelled',
        })
        .eq('id', lessonId)
        .select('*')
        .single()

      if (cancelError) {
        console.error('Error cancelling lesson', cancelError)
        return NextResponse.json({ error: 'Failed to cancel lesson.' }, { status: 500 })
      }

      const eventKey = `lesson:${lessonId}:changed:cancelled:${cancelledLesson.updated_at ?? new Date().toISOString()}`
      const events: NotificationEventInsert[] = [
        {
          user_id: lesson.teacher_id,
          notification_type: 'lesson_changed',
          event_key: eventKey,
          source_type: 'lesson',
          source_id: lessonId,
          role: 'teacher',
          priority: 3,
          payload: {
            href: `/teacher/lessons?lesson=${lessonId}`,
            title: 'Lesson cancelled',
            message: `Lesson with ${studentName} was canceled.`,
            email_subject: 'Lesson cancelled',
            email_body: `Lesson with ${studentName} was canceled.`,
            lesson_id: lessonId,
            start_time: lesson.start_time,
            end_time: lesson.end_time,
            variant: 'cancelled',
          },
        },
      ]

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
            title: 'Lesson cancelled',
            message: `Lesson with ${teacherName} was canceled.`,
            email_subject: 'Lesson cancelled',
            email_body: `Lesson with ${teacherName} was canceled.`,
            lesson_id: lessonId,
            start_time: lesson.start_time,
            end_time: lesson.end_time,
            variant: 'cancelled',
          },
        })
      }

      await insertNotificationEvents(serviceSupabase, events)

      return NextResponse.json({
        lesson: cancelledLesson,
      })
    }

    // For rescheduling or metadata updates, ensure lesson is not cancelled/completed
    if (lesson.status === 'cancelled' || lesson.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot update cancelled or completed lessons.' },
        { status: 409 }
      )
    }

    // If times are being changed, enforce validations
    if (timeChanged) {
      if (newEnd <= newStart) {
        return NextResponse.json(
          { error: 'End time must be after start time.' },
          { status: 400 }
        )
      }

      if (newStart <= now) {
        return NextResponse.json(
          { error: 'Start time must be in the future.' },
          { status: 409 }
        )
      }

      const requestedDuration = differenceInMinutes(newEnd, newStart)
      if (requestedDuration <= 0) {
        return NextResponse.json(
          { error: 'Invalid lesson duration.' },
          { status: 400 }
        )
      }

      // Fetch all student ids for this student user
      const { data: studentUserRows, error: studentUserError } = await serviceSupabase
        .from('students')
        .select('id, user_id')
        .eq('id', lesson.student_id)
        .single()

      if (studentUserError || !studentUserRows) {
        console.error('Error fetching student for overlap check', studentUserError)
        return NextResponse.json({ error: 'Failed to verify availability' }, { status: 500 })
      }

      const { data: siblingIdsRows, error: siblingIdsError } = await serviceSupabase
        .from('students')
        .select('id')
        .eq('user_id', studentUserRows.user_id)

      if (siblingIdsError) {
        console.error('Error fetching sibling students for overlap check', siblingIdsError)
        return NextResponse.json({ error: 'Failed to verify availability' }, { status: 500 })
      }

      const studentIdsForUser = (siblingIdsRows || []).map((s) => s.id)

      const { hasConflict, error: overlapError } = await checkLessonOverlap({
        supabase: serviceSupabase,
        teacherId: lesson.teacher_id,
        studentIds: studentIdsForUser,
        start: newStart,
        end: newEnd,
        excludeLessonId: lessonId,
      })

      if (overlapError) {
        console.error('Overlap check failed', overlapError)
        return NextResponse.json({ error: 'Failed to verify availability' }, { status: 500 })
      }

      if (hasConflict) {
        return NextResponse.json(
          { error: 'This time overlaps another lesson. Please choose a different time.' },
          { status: 409 }
        )
      }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {}

    if (timeChanged) {
      updatePayload.start_time = newStart.toISOString()
      updatePayload.end_time = newEnd.toISOString()
    }
    if (typeof body.title === 'string') updatePayload.title = body.title
    if (body.description !== undefined) updatePayload.description = body.description

    // Determine next status
    let nextStatus: LessonStatus = lesson.status
    if (timeChanged && lesson.status === 'confirmed') {
      nextStatus = 'pending'
    }
    // Cancellation is handled above; at this point body.status cannot be 'cancelled'
    if (body.status) {
      nextStatus = body.status
    }
    updatePayload.status = nextStatus

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No changes provided.' }, { status: 400 })
    }

    const { data: updatedLesson, error: updateError } = await serviceSupabase
      .from('lessons')
      .update(updatePayload)
      .eq('id', lessonId)
      .select('*')
      .single()

    if (updateError || !updatedLesson) {
      console.error('Error updating lesson', updateError)
      return NextResponse.json({ error: 'Failed to update lesson.' }, { status: 500 })
    }

    if (timeChanged) {
      const eventKey = `lesson:${lessonId}:changed:rescheduled:${updatedLesson.updated_at ?? new Date().toISOString()}`
      const events: NotificationEventInsert[] = [
        {
          user_id: lesson.teacher_id,
          notification_type: 'lesson_changed',
          event_key: eventKey,
          source_type: 'lesson',
          source_id: lessonId,
          role: 'teacher',
          priority: 3,
          payload: {
            href: `/teacher/lessons?lesson=${lessonId}`,
            title: 'Lesson rescheduled',
            message: `Lesson with ${studentName} was rescheduled.`,
            email_subject: 'Lesson rescheduled',
            email_body: `Lesson with ${studentName} was rescheduled.`,
            lesson_id: lessonId,
            start_time: updatedLesson.start_time,
            end_time: updatedLesson.end_time,
            variant: 'rescheduled',
          },
        },
      ]

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
            title: 'Lesson rescheduled',
            message: `Lesson with ${teacherName} was rescheduled.`,
            email_subject: 'Lesson rescheduled',
            email_body: `Lesson with ${teacherName} was rescheduled.`,
            lesson_id: lessonId,
            start_time: updatedLesson.start_time,
            end_time: updatedLesson.end_time,
            variant: 'rescheduled',
          },
        })
      }

      await insertNotificationEvents(serviceSupabase, events)
    }

    return NextResponse.json({
      lesson: {
        id: lessonId,
        status: nextStatus,
        start_time: updatedLesson.start_time,
        end_time: updatedLesson.end_time,
      },
    })
  } catch (error) {
    console.error('Error in PATCH /api/teacher/lessons/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


