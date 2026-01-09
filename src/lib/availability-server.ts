'use server'

import { addHours, addDays, startOfDay, endOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import {
  getAvailabilityRanges,
  subtractBusyFromAvailability,
  generateAvailableSlots,
  filterConflictingSlots,
  type AvailabilityRange,
} from '@/lib/availability'
import type { AvailabilityBlock, Lesson } from '@/types/database'

export interface GetBookableSlotsOptions {
  teacherId: string
  startDate: Date
  endDate: Date
  lessonDurationMinutes?: number
  minAdvanceHours?: number
  maxBookingDays?: number
}

export interface BookableSlot {
  startTime: string
  endTime: string
}

export async function getBookableSlotsForTeacher(
  options: GetBookableSlotsOptions
): Promise<BookableSlot[]> {
  const {
    teacherId,
    startDate,
    endDate,
    lessonDurationMinutes = 60,
    minAdvanceHours = 12,
    maxBookingDays = 30,
  } = options

  const supabase = await createClient()

  const now = new Date()
  const minStart = addHours(now, minAdvanceHours)
  const maxStart = addDays(now, maxBookingDays)

  const queryStart = startOfDay(startDate < minStart ? minStart : startDate)
  const queryEnd = endOfDay(endDate > maxStart ? maxStart : endDate)

  // Fetch availability blocks
  const { data: availabilityBlocks, error: availabilityError } = await supabase
    .from('availability_blocks')
    .select('*')
    .eq('teacher_id', teacherId)

  if (availabilityError) {
    console.error('Error fetching availability blocks', availabilityError)
    throw availabilityError
  }

  const blocks = (availabilityBlocks || []) as AvailabilityBlock[]

  // Fetch lessons that block booking (pending + confirmed)
  const { data: lessonRows, error: lessonsError } = await supabase
    .from('lessons')
    .select('*')
    .eq('teacher_id', teacherId)
    .in('status', ['pending', 'confirmed'])
    .lt('start_time', queryEnd.toISOString())
    .gt('end_time', queryStart.toISOString())

  if (lessonsError) {
    console.error('Error fetching lessons for slots', lessonsError)
    throw lessonsError
  }

  const lessons = (lessonRows || []) as Lesson[]

  // Compute availability ranges and subtract busy lessons
  const availabilityRanges: AvailabilityRange[] = getAvailabilityRanges(
    blocks,
    queryStart,
    queryEnd
  )

  const busyIntervals = lessons.map((lesson) => ({
    start: new Date(lesson.start_time),
    end: new Date(lesson.end_time),
  }))

  const freeRanges = subtractBusyFromAvailability(availabilityRanges, busyIntervals)

  // Generate discrete slots from free ranges
  const allSlots = generateAvailableSlots(
    freeRanges,
    lessonDurationMinutes,
    0 // buffer between slots (could be extended later)
  )

  // Remove slots that conflict with lessons just in case
  const conflictFreeSlots = filterConflictingSlots(allSlots, busyIntervals)

  // Apply minAdvanceHours and maxBookingDays constraints precisely
  const constrainedSlots = conflictFreeSlots.filter((slot) => {
    return slot.start >= minStart && slot.start <= maxStart
  })

  // Convert to ISO strings
  return constrainedSlots.map((slot) => ({
    startTime: slot.start.toISOString(),
    endTime: slot.end.toISOString(),
  }))
}


