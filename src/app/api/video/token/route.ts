import { NextResponse } from 'next/server'

import { createLessonAccessToken } from '@/lib/livekit/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface TokenRequestBody {
  lesson_id?: string
}

function getErrorField(err: unknown, key: string): unknown {
  if (typeof err !== 'object' || err === null) return undefined
  const record = err as Record<string, unknown>
  return key in record ? record[key] : undefined
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const serviceSupabase = await createServiceClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let payload: TokenRequestBody
    try {
      payload = (await request.json()) as TokenRequestBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!payload?.lesson_id) {
      return NextResponse.json({ error: 'lesson_id is required' }, { status: 400 })
    }

    const { data: lesson, error: lessonError } = await serviceSupabase
      .from('lessons')
      .select('id, teacher_id, student_id')
      .eq('id', payload.lesson_id)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    let identity: string | null = null
    let role: 'teacher' | 'student' | null = null
    let studentId: string | null = null

    if (lesson.teacher_id === user.id) {
      identity = `teacher-${user.id}`
      role = 'teacher'
    } else {
      // Check lesson_students join table for membership
      const { data: participant, error: participantError } = await serviceSupabase
        .from('lesson_students')
        .select('student_id, student:students!inner(id, user_id)')
        .eq('lesson_id', lesson.id)
        .eq('student.user_id', user.id)
        .maybeSingle()

      const isLessonStudentsMissing =
        Boolean(participantError) &&
        (String(getErrorField(participantError, 'code')) === '42P01' ||
          String(getErrorField(participantError, 'message') || '')
            .toLowerCase()
            .includes('lesson_students') ||
          Number(getErrorField(participantError, 'status')) === 404)
      if (participantError && !isLessonStudentsMissing) {
        console.error('Error validating lesson participant', participantError)
        return NextResponse.json({ error: 'Unable to validate participant' }, { status: 500 })
      }

      if (participant?.student) {
        const studentRel = (participant as unknown as { student?: unknown }).student
        const student =
          Array.isArray(studentRel) ? (studentRel[0] as Record<string, unknown> | undefined) : (studentRel as Record<string, unknown> | undefined)
        const idValue = student ? student['id'] : undefined
        studentId = typeof idValue === 'string' ? idValue : null
      } else if (lesson.student_id) {
        // Fallback to legacy single-student lessons
        const { data: legacyStudent } = await serviceSupabase
          .from('students')
          .select('id, user_id')
          .eq('id', lesson.student_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (legacyStudent) {
          studentId = legacyStudent.id
        }
      }

      if (studentId) {
        identity = `student-${studentId}`
        role = 'student'
      }
    }

    if (!identity || !role) {
      return NextResponse.json({ error: 'Not authorized for this lesson' }, { status: 403 })
    }

    const tokenResult = createLessonAccessToken({
      lessonId: lesson.id,
      identity,
      metadata: {
        role,
        lessonId: lesson.id,
        profileId: user.id,
        studentId,
      },
    })

    const token = await Promise.resolve(tokenResult)
    if (typeof token !== 'string' || token.length === 0) {
      console.error('LiveKit token generation returned non-string token')
      return NextResponse.json({ error: 'Unable to start the call.' }, { status: 500 })
    }

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Error issuing LiveKit token', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

