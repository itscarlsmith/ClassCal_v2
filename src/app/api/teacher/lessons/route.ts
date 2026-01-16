import { NextResponse } from 'next/server'
import { differenceInMinutes } from 'date-fns'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkLessonOverlap } from '@/lib/lessons-server'
import type { LessonStatus } from '@/types/database'

interface CreateLessonBody {
  student_id?: string
  title?: string
  description?: string | null
  start_time?: string
  end_time?: string
  credits_used?: number
  meeting_url?: string | null
  is_recurring?: boolean
  status?: LessonStatus
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const serviceSupabase = await createServiceClient()

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = (await request.json()) as CreateLessonBody
    const {
      student_id,
      title,
      description,
      start_time,
      end_time,
      credits_used,
      meeting_url,
      is_recurring,
      status,
    } = body

    if (!student_id || !title || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'Missing student_id, title, start_time, or end_time' },
        { status: 400 }
      )
    }

    const start = new Date(start_time)
    const end = new Date(end_time)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid start_time or end_time' }, { status: 400 })
    }

    if (end <= start) {
      return NextResponse.json(
        { error: 'End time must be after start time.' },
        { status: 400 }
      )
    }

    const now = new Date()
    if (start <= now) {
      return NextResponse.json(
        { error: 'Start time must be in the future.' },
        { status: 409 }
      )
    }

    const duration = differenceInMinutes(end, start)
    if (duration <= 0) {
      return NextResponse.json({ error: 'Invalid lesson duration.' }, { status: 400 })
    }

    if (credits_used !== undefined && credits_used < 1) {
      return NextResponse.json({ error: 'Credits must be at least 1.' }, { status: 400 })
    }

    // Ensure the student exists and belongs to this teacher
    const { data: studentRow, error: studentFetchError } = await serviceSupabase
      .from('students')
      .select('id, user_id, teacher_id')
      .eq('id', student_id)
      .single()

    if (studentFetchError || !studentRow) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (studentRow.teacher_id !== userData.user.id) {
      return NextResponse.json({ error: 'Student not linked to this teacher' }, { status: 403 })
    }

    // Collect all student_ids for the same student user (prevent double-booking with other teachers)
    const { data: siblingStudents, error: siblingError } = await serviceSupabase
      .from('students')
      .select('id')
      .eq('user_id', studentRow.user_id)

    if (siblingError) {
      console.error('Error fetching sibling students for overlap check', siblingError)
      return NextResponse.json({ error: 'Failed to verify availability' }, { status: 500 })
    }

    const studentIdsForUser = (siblingStudents || []).map((s) => s.id)

    const initialStatus: LessonStatus = status === 'confirmed' ? 'confirmed' : 'pending'

    const { hasConflict, error: overlapError } = await checkLessonOverlap({
      supabase: serviceSupabase,
      teacherId: userData.user.id,
      studentIds: studentIdsForUser,
      start,
      end,
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

    const { data: newLesson, error: insertError } = await serviceSupabase
      .from('lessons')
      .insert({
        teacher_id: userData.user.id,
        student_id,
        title,
        description: description ?? null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        credits_used: credits_used ?? 1,
        meeting_url: meeting_url ?? null,
        is_recurring: is_recurring ?? false,
        status: initialStatus,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Error creating lesson', insertError)
      return NextResponse.json({ error: 'Failed to create lesson.' }, { status: 500 })
    }

    return NextResponse.json({ lesson: newLesson })
  } catch (error) {
    console.error('Error in POST /api/teacher/lessons', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


