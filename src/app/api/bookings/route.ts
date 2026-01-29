import { NextResponse } from 'next/server'
import { startOfDay, endOfDay, differenceInMinutes, addHours } from 'date-fns'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBookableSlotsForTeacher } from '@/lib/availability-server'
import { checkLessonOverlap } from '@/lib/lessons-server'

const MIN_ADVANCE_HOURS = Number(process.env.NEXT_PUBLIC_MIN_BOOKING_NOTICE_HOURS || 12)
const MAX_BOOKING_DAYS = Number(process.env.NEXT_PUBLIC_MAX_BOOKING_DAYS || 30)
const DEFAULT_DURATION = Number(process.env.NEXT_PUBLIC_DEFAULT_LESSON_MINUTES || 60)

interface BookingRequestBody {
  slotStart: string
  slotEnd: string
  durationMinutes: number
  teacherId?: string
  studentId?: string
  title?: string
  note?: string
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

type NotificationEventInsert = {
  user_id: string
  notification_type: 'lesson_booked_by_student'
  event_key: string
  source_type: 'lesson'
  source_id: string
  role: 'teacher'
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BookingRequestBody
    const {
      slotStart,
      slotEnd,
      durationMinutes,
      teacherId: requestedTeacherId,
      studentId: requestedStudentId,
      title,
      note,
    } = body

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

    const actualDuration = differenceInMinutes(slotEndDate, slotStartDate)

    if (actualDuration !== durationMinutes) {
      return NextResponse.json(
        { error: 'Requested duration does not match start and end times.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const serviceSupabase = await createServiceClient()

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

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
    const studentRecord =
      (requestedStudentId
        ? studentRows.find(
            (row) =>
              row.id === requestedStudentId &&
              (!requestedTeacherId || row.teacher_id === requestedTeacherId)
          )
        : null) ??
      (requestedTeacherId
        ? studentRows.find((row) => row.teacher_id === requestedTeacherId)
        : null) ??
      studentRows[0]

    const teacherId = studentRecord.teacher_id

    if (!teacherId) {
      return NextResponse.json(
        { error: 'Teacher association not found' },
        { status: 400 }
      )
    }

    if (requestedTeacherId && requestedTeacherId !== teacherId) {
      return NextResponse.json(
        { error: 'Teacher mismatch for this student' },
        { status: 400 }
      )
    }

    const student = studentRecord

    const { data: teacherSettings, error: teacherSettingsError } = await serviceSupabase
      .from('teacher_settings')
      .select('booking_buffer_hours')
      .eq('teacher_id', teacherId)
      .maybeSingle()

    if (teacherSettingsError) {
      console.error('Error fetching teacher settings for booking buffer', teacherSettingsError)
      return NextResponse.json(
        { error: 'Failed to load teacher settings. Please try again.' },
        { status: 500 }
      )
    }

    const minAdvanceHours =
      teacherSettings?.booking_buffer_hours != null
        ? teacherSettings.booking_buffer_hours
        : MIN_ADVANCE_HOURS

    const earliestAllowedStart = addHours(new Date(), minAdvanceHours)

    if (slotStartDate < earliestAllowedStart) {
      return NextResponse.json(
        { error: 'This time is too soon to book. Please choose a later slot.' },
        { status: 400 }
      )
    }

    // Recompute bookable slots for the day of the requested slot
    const dayStart = startOfDay(slotStartDate)
    const dayEnd = endOfDay(slotStartDate)

    const bookableSlots = await getBookableSlotsForTeacher({
      teacherId,
      startDate: dayStart,
      endDate: dayEnd,
      lessonDurationMinutes: DEFAULT_DURATION || 60,
      minAdvanceHours,
      maxBookingDays: MAX_BOOKING_DAYS,
    })

    if (durationMinutes !== 60 && durationMinutes !== 30) {
      return NextResponse.json(
        { error: 'Unsupported duration. Only 60 or 30 minutes allowed.' },
        { status: 400 }
      )
    }

    // For 60-minute or 30-minute lessons, ensure the requested window
    // fits entirely inside one of the canonical 60-minute bookable slots.
    const containerSlot = bookableSlots.find((slot) => {
      const canonicalStart = new Date(slot.startTime)
      const canonicalEnd = new Date(slot.endTime)
      return slotStartDate >= canonicalStart && slotEndDate <= canonicalEnd
    })

    if (!containerSlot) {
      return NextResponse.json(
        { error: 'Selected time is no longer available. Please pick another slot.' },
        { status: 409 }
      )
    }

    // Ensure student has at least 1 credit
    if ((student.credits ?? 0) < 1) {
      return NextResponse.json(
        { error: 'You do not have enough credits to book a lesson.' },
        { status: 400 }
      )
    }

    const { data: teacherProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', teacherId)
      .single()

    const teacherName = teacherProfile?.full_name || 'your teacher'
    const canonicalTitle = title || `Lesson with ${teacherName}`

    const studentIdsForUser = studentRows.map((row) => row.id)
    const overlap = await checkLessonOverlap({
      supabase: serviceSupabase,
      teacherId,
      studentIds: studentIdsForUser,
      start: slotStartDate,
      end: slotEndDate,
    })

    if (overlap.error) {
      console.error('Overlap check failed', overlap.error)
      return NextResponse.json(
        { error: 'Failed to verify availability. Please try again.' },
        { status: 500 }
      )
    }

    if (overlap.hasConflict) {
      return NextResponse.json(
        { error: 'You already have a lesson at this time. Please pick another slot.' },
        { status: 409 }
      )
    }

    const { data: newLesson, error: insertError } = await serviceSupabase
      .from('lessons')
      .insert({
        teacher_id: teacherId,
        student_id: student.id,
        title: canonicalTitle,
        description: note || null,
        start_time: slotStartDate.toISOString(),
        end_time: slotEndDate.toISOString(),
        status: 'confirmed',
        is_recurring: false,
        credits_used: 1,
      })
      .select('*')
      .single()

    if (insertError) {
      const message = insertError.message || ''
      if (message.includes('credit_balance_negative')) {
        return NextResponse.json(
          { error: 'You do not have enough credits to book a lesson.' },
          { status: 400 }
        )
      }
      console.error('Error inserting lesson from booking', insertError)
      return NextResponse.json(
        { error: 'Failed to create lesson. Please try again.' },
        { status: 500 }
      )
    }

    const studentName = student.full_name || 'a student'
    const titleText = 'Lesson booked'
    const messageText = `Lesson booked by ${studentName}.`

    await insertNotificationEvents(serviceSupabase, [
      {
        user_id: teacherId,
        notification_type: 'lesson_booked_by_student',
        event_key: `lesson:${newLesson.id}:booked_by_student:${newLesson.created_at}`,
        source_type: 'lesson',
        source_id: newLesson.id,
        role: 'teacher',
        priority: 3,
        payload: {
          href: `/teacher/lessons?lesson=${newLesson.id}`,
          title: titleText,
          message: messageText,
          email_subject: titleText,
          email_body: messageText,
          lesson_id: newLesson.id,
          start_time: newLesson.start_time,
          end_time: newLesson.end_time,
        },
      },
    ])

    return NextResponse.json({ lesson: newLesson })
  } catch (error) {
    console.error('Error in POST /api/bookings', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


