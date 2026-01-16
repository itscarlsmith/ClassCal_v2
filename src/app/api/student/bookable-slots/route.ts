import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBookableSlotsForTeacher } from '@/lib/availability-server'

const MIN_ADVANCE_HOURS = Number(process.env.NEXT_PUBLIC_MIN_BOOKING_NOTICE_HOURS || 12)
const MAX_BOOKING_DAYS = Number(process.env.NEXT_PUBLIC_MAX_BOOKING_DAYS || 30)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    const teacherParam = searchParams.get('teacher')

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: 'Missing start or end query parameters' },
        { status: 400 }
      )
    }

    const startDate = new Date(startParam)
    const endDate = new Date(endParam)

    const supabase = await createClient()
    const serviceSupabase = await createServiceClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find the student record for this user to determine their teacher
    const { data: studentRows, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userData.user.id)

    if (studentError || !studentRows || studentRows.length === 0) {
      return NextResponse.json(
        { error: 'Student or teacher relationship not found' },
        { status: 400 }
      )
    }

    const selectedTeacherRow =
      teacherParam
        ? studentRows.find((row) => row.teacher_id === teacherParam)
        : studentRows[0]

    if (!selectedTeacherRow?.teacher_id) {
      return NextResponse.json(
        { error: 'Teacher not linked to this student' },
        { status: 400 }
      )
    }

    const teacherId = selectedTeacherRow.teacher_id

    const { data: teacherSettings, error: teacherSettingsError } = await serviceSupabase
      .from('teacher_settings')
      .select('booking_buffer_hours')
      .eq('teacher_id', teacherId)
      .maybeSingle()

    if (teacherSettingsError) {
      console.error('Error fetching teacher settings for booking buffer', teacherSettingsError)
      return NextResponse.json({ error: 'Failed to load teacher settings' }, { status: 500 })
    }

    const minAdvanceHours =
      teacherSettings?.booking_buffer_hours != null
        ? teacherSettings.booking_buffer_hours
        : MIN_ADVANCE_HOURS

    const slots = await getBookableSlotsForTeacher({
      teacherId,
      startDate,
      endDate,
      lessonDurationMinutes: 60,
      minAdvanceHours,
      maxBookingDays: MAX_BOOKING_DAYS,
    })

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Error in student/bookable-slots', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}


