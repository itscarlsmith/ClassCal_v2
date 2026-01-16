import { NextResponse } from 'next/server'
import { differenceInMinutes } from 'date-fns'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkLessonOverlap } from '@/lib/lessons-server'
import type { LessonStatus } from '@/types/database'

interface CreateLessonBody {
  student_id?: string
  additional_student_ids?: string[]
  title?: string
  description?: string | null
  start_time?: string
  end_time?: string
  credits_used?: number
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
      additional_student_ids,
      title,
      description,
      start_time,
      end_time,
      credits_used,
      is_recurring,
      status,
    } = body

    if (!student_id || !title || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'Missing student_id, title, start_time, or end_time' },
        { status: 400 }
      )
    }

    const additionalIdsRaw = Array.isArray(additional_student_ids)
      ? additional_student_ids
      : []
    const additionalIds = additionalIdsRaw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    const participantIds = Array.from(new Set([student_id, ...additionalIds]))

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

    // Ensure all participants exist and belong to this teacher
    const { data: studentRows, error: studentsFetchError } = await serviceSupabase
      .from('students')
      .select('id, user_id, teacher_id')
      .in('id', participantIds)

    if (studentsFetchError) {
      console.error('Error fetching students for lesson creation', studentsFetchError)
      return NextResponse.json({ error: 'Failed to verify participants' }, { status: 500 })
    }

    const fetched = studentRows || []
    if (fetched.length !== participantIds.length) {
      return NextResponse.json({ error: 'One or more students not found' }, { status: 404 })
    }

    if (fetched.some((row) => row.teacher_id !== userData.user.id)) {
      return NextResponse.json({ error: 'One or more students not linked to this teacher' }, { status: 403 })
    }

    // Prevent double-booking:
    // - For each student user_id, include all their linked student rows (sibling student ids)
    // - Also include student ids that do not have a user_id (no siblings to consider)
    const userIds = Array.from(
      new Set(fetched.map((row) => row.user_id).filter((id): id is string => typeof id === 'string' && id.length > 0))
    )

    let siblingRows: { id: string; user_id: string | null }[] = []
    if (userIds.length > 0) {
      const { data: siblings, error: siblingError } = await serviceSupabase
        .from('students')
        .select('id, user_id')
        .in('user_id', userIds)

      if (siblingError) {
        console.error('Error fetching sibling students for overlap check', siblingError)
        return NextResponse.json({ error: 'Failed to verify availability' }, { status: 500 })
      }
      siblingRows = (siblings || []) as any
    }

    const siblingsByUserId = new Map<string, string[]>()
    for (const row of siblingRows) {
      if (!row.user_id) continue
      const list = siblingsByUserId.get(row.user_id) || []
      list.push(row.id)
      siblingsByUserId.set(row.user_id, list)
    }

    const overlapStudentIds = Array.from(
      new Set(
        fetched.flatMap((row) => {
          if (row.user_id && siblingsByUserId.has(row.user_id)) {
            return siblingsByUserId.get(row.user_id) || []
          }
          return [row.id]
        })
      )
    )

    const initialStatus: LessonStatus = status === 'confirmed' ? 'confirmed' : 'pending'

    const { hasConflict, error: overlapError } = await checkLessonOverlap({
      supabase: serviceSupabase,
      teacherId: userData.user.id,
      studentIds: overlapStudentIds,
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
        is_recurring: is_recurring ?? false,
        status: initialStatus,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Error creating lesson', insertError)
      return NextResponse.json({ error: 'Failed to create lesson.' }, { status: 500 })
    }

    // Ensure all participants are represented in lesson_students (primary + additional)
    const participantsToInsert = participantIds.map((id) => ({
      lesson_id: newLesson.id,
      student_id: id,
    }))
    const { error: participantInsertError } = await serviceSupabase
      .from('lesson_students')
      .upsert(participantsToInsert, {
        onConflict: 'lesson_id,student_id',
        ignoreDuplicates: true,
      })

    if (participantInsertError) {
      console.error('Error inserting lesson participants', participantInsertError)
      return NextResponse.json({ error: 'Failed to create lesson participants.' }, { status: 500 })
    }

    return NextResponse.json({ lesson: newLesson })
  } catch (error) {
    console.error('Error in POST /api/teacher/lessons', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


