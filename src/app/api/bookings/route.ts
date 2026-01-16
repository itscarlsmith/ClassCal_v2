import { NextResponse } from 'next/server'
import { startOfDay, endOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getBookableSlotsForTeacher } from '@/lib/availability-server'

interface BookingRequestBody {
  slotStart: string
  slotEnd: string
  durationMinutes: number
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BookingRequestBody
    const { slotStart, slotEnd, durationMinutes } = body

    if (!slotStart || !slotEnd || !durationMinutes) {
      return NextResponse.json(
        { error: 'Missing slotStart, slotEnd, or durationMinutes' },
        { status: 400 }
      )
    }

    const slotStartDate = new Date(slotStart)
    const slotEndDate = new Date(slotEnd)

    if (Number.isNaN(slotStartDate.getTime()) || Number.isNaN(slotEndDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Resolve student and teacher from the authenticated user
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

    const teacherId: string = student.teacher_id
    const studentId: string = student.id

    // Recompute bookable slots for the day of the requested slot
    const dayStart = startOfDay(slotStartDate)
    const dayEnd = endOfDay(slotStartDate)

    const bookableSlots = await getBookableSlotsForTeacher({
      teacherId,
      startDate: dayStart,
      endDate: dayEnd,
      lessonDurationMinutes: 60,
      minAdvanceHours: 12,
      maxBookingDays: 30,
    })

    const canonicalSlot = bookableSlots.find(
      (slot) => slot.startTime === slotStart && slot.endTime === slotEnd
    )

    if (!canonicalSlot) {
      return NextResponse.json(
        { error: 'Selected time is no longer available. Please pick another slot.' },
        { status: 409 }
      )
    }

    // Determine actual lesson end based on requested duration
    const requestedEnd = new Date(slotStartDate.getTime() + durationMinutes * 60 * 1000)

    if (durationMinutes === 60) {
      if (requestedEnd.getTime() !== slotEndDate.getTime()) {
        return NextResponse.json(
          { error: 'Requested duration does not match the slot.' },
          { status: 400 }
        )
      }
    } else if (durationMinutes === 30) {
      // Must fit entirely within the 1-hour slot (first 30 minutes)
      if (requestedEnd > slotEndDate) {
        return NextResponse.json(
          { error: 'Requested 30-minute lesson does not fit in the slot.' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported duration. Only 60 or 30 minutes allowed.' },
        { status: 400 }
      )
    }

    // Ensure student has at least 1 credit
    if ((student.credits ?? 0) < 1) {
      return NextResponse.json(
        { error: 'You do not have enough credits to book a lesson.' },
        { status: 400 }
      )
    }

    const title = `Lesson with ${student.full_name || 'your teacher'}`

    const { data: newLesson, error: insertError } = await supabase
      .from('lessons')
      .insert({
        teacher_id: teacherId,
        student_id: studentId,
        title,
        description: null,
        start_time: slotStartDate.toISOString(),
        end_time: requestedEnd.toISOString(),
        status: 'confirmed',
        is_recurring: false,
        credits_used: 1,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Error inserting lesson from booking', insertError)
      return NextResponse.json(
        { error: 'Failed to create lesson. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ lesson: newLesson })
  } catch (error) {
    console.error('Error in POST /api/bookings', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


