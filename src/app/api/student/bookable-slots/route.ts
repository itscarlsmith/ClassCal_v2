import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookableSlotsForTeacher } from '@/lib/availability-server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: 'Missing start or end query parameters' },
        { status: 400 }
      )
    }

    const startDate = new Date(startParam)
    const endDate = new Date(endParam)

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find the student record for this user to determine their teacher
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userData.user.id)
      .single()

    if (studentError || !student?.teacher_id) {
      return NextResponse.json(
        { error: 'Student or teacher relationship not found' },
        { status: 400 }
      )
    }

    const slots = await getBookableSlotsForTeacher({
      teacherId: student.teacher_id,
      startDate,
      endDate,
      lessonDurationMinutes: 60,
      minAdvanceHours: 12,
      maxBookingDays: 30,
    })

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Error in student/bookable-slots', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}


