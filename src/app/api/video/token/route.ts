import { NextResponse } from 'next/server'

import { createLessonAccessToken } from '@/lib/livekit/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface TokenRequestBody {
  lesson_id?: string
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
      // Authorize student via primary lesson.student_id
      const { data: studentRow, error: studentError } = await serviceSupabase
        .from('students')
        .select('id')
        .eq('id', lesson.student_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (studentError) {
        console.error('Error validating lesson student', studentError)
        return NextResponse.json({ error: 'Unable to validate student' }, { status: 500 })
      }

      if (studentRow?.id) {
        studentId = studentRow.id
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

