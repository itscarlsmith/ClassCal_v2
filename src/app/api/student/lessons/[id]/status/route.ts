import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkLessonOverlap } from '@/lib/lessons-server'
import type { LessonStatus } from '@/types/database'

type Action = 'accept' | 'decline' | 'cancel'

interface StatusRequestBody {
  action: Action
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

    // Ensure the authenticated user is linked to the lesson via students.user_id
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(
        'id, status, start_time, end_time, teacher_id, student_id, student:students!inner(id, user_id)'
      )
      .eq('id', lessonId)
      .eq('student.user_id', userData.user.id)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { error: 'Lesson not found for this student' },
        { status: 404 }
      )
    }

    const lessonStudent =
      Array.isArray((lesson as any).student) ? (lesson as any).student?.[0] : (lesson as any).student
    const lessonStudentUserId: string | null = lessonStudent?.user_id ?? null
    if (!lessonStudentUserId) {
      return NextResponse.json({ error: 'Invalid lesson student context' }, { status: 500 })
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

      const { data: siblingStudents, error: siblingError } = await serviceSupabase
        .from('students')
        .select('id')
        .eq('user_id', lessonStudentUserId)

      if (siblingError) {
        console.error('Error fetching sibling students for overlap check', siblingError)
        return NextResponse.json(
          { error: 'Failed to verify availability.' },
          { status: 500 }
        )
      }

      const studentIdsForUser = (siblingStudents || []).map((s) => s.id)

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

    return NextResponse.json({
      lesson: updatedLesson,
    })
  } catch (error) {
    console.error('Error in POST /api/student/lessons/[id]/status', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

