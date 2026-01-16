import { NextResponse } from 'next/server'
import { getBookableSlotsForTeacher } from '@/lib/availability-server'
import { createClient } from '@/lib/supabase/server'

// DEV-ONLY: simple endpoint to verify slot generation. Do not expose in production.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find the teacher profile for the current user (assumes they are a teacher)
    const teacherId = userData.user.id

    const now = new Date()
    const startDate = now
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // next 7 days

    const slots = await getBookableSlotsForTeacher({
      teacherId,
      startDate,
      endDate,
      lessonDurationMinutes: 60,
      minAdvanceHours: 12,
      maxBookingDays: 30,
    })

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Error in debug/bookable-slots', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}


