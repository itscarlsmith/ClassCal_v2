import {
  addDays,
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  getDay,
  parseISO,
  isSameDay,
  addMinutes,
} from 'date-fns'
import type { AvailabilityBlock } from '@/types/database'

export interface AvailabilityRange {
  start: Date
  end: Date
  isOneTime: boolean
  blockId: string
}

export interface AvailabilitySlot {
  start: Date
  end: Date
}

export interface BusyInterval {
  start: Date
  end: Date
}

/**
 * Parse a time string (HH:mm) and apply it to a given date
 */
function parseTimeToDate(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  let result = setHours(date, hours)
  result = setMinutes(result, minutes)
  return result
}

/**
 * Get all availability ranges for a given date range, combining weekly and one-time blocks.
 * 
 * @param blocks - All availability blocks (both weekly and one-time)
 * @param startDate - Start of the range to check
 * @param endDate - End of the range to check
 * @returns Array of availability ranges with start/end times
 */
export function getAvailabilityRanges(
  blocks: AvailabilityBlock[],
  startDate: Date,
  endDate: Date
): AvailabilityRange[] {
  const ranges: AvailabilityRange[] = []
  
  // Separate weekly and one-time blocks
  const weeklyBlocks = blocks.filter((b) => b.is_recurring && b.day_of_week !== null)
  const oneTimeBlocks = blocks.filter((b) => !b.is_recurring && b.specific_date !== null)
  
  // Iterate through each day in the range
  let currentDate = startOfDay(startDate)
  const rangeEnd = endOfDay(endDate)
  
  while (currentDate <= rangeEnd) {
    const dayOfWeek = getDay(currentDate)
    
    // Apply weekly blocks for this day of week
    for (const block of weeklyBlocks) {
      if (block.day_of_week === dayOfWeek) {
        const rangeStart = parseTimeToDate(currentDate, block.start_time)
        const rangeEndTime = parseTimeToDate(currentDate, block.end_time)
        
        // Only include if the range is within our target range
        if (rangeEndTime > startDate && rangeStart < endDate) {
          ranges.push({
            start: rangeStart,
            end: rangeEndTime,
            isOneTime: false,
            blockId: block.id,
          })
        }
      }
    }
    
    // Apply one-time blocks for this specific date
    for (const block of oneTimeBlocks) {
      if (block.specific_date) {
        const blockDate = parseISO(block.specific_date)
        if (isSameDay(currentDate, blockDate)) {
          const rangeStart = parseTimeToDate(currentDate, block.start_time)
          const rangeEndTime = parseTimeToDate(currentDate, block.end_time)
          
          // Only include if the range is within our target range
          if (rangeEndTime > startDate && rangeStart < endDate) {
            ranges.push({
              start: rangeStart,
              end: rangeEndTime,
              isOneTime: true,
              blockId: block.id,
            })
          }
        }
      }
    }
    
    currentDate = addDays(currentDate, 1)
  }
  
  // Sort by start time
  ranges.sort((a, b) => a.start.getTime() - b.start.getTime())
  
  return ranges
}

/**
 * Subtract busy intervals (e.g. lessons) from availability ranges.
 * Returns new non-overlapping ranges representing truly free time.
 */
export function subtractBusyFromAvailability(
  ranges: AvailabilityRange[],
  busy: BusyInterval[]
): AvailabilityRange[] {
  if (busy.length === 0 || ranges.length === 0) return ranges

  // Sort busy intervals by start time for deterministic splitting
  const sortedBusy = [...busy].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )

  const result: AvailabilityRange[] = []

  for (const range of ranges) {
    // Start with the full range as the only remaining fragment
    let fragments: AvailabilityRange[] = [range]

    for (const busyInterval of sortedBusy) {
      const nextFragments: AvailabilityRange[] = []

      for (const fragment of fragments) {
        // No overlap: keep fragment as-is
        if (busyInterval.end <= fragment.start || busyInterval.start >= fragment.end) {
          nextFragments.push(fragment)
          continue
        }

        // Busy fully covers the fragment: remove it
        if (busyInterval.start <= fragment.start && busyInterval.end >= fragment.end) {
          continue
        }

        // Busy overlaps the start of fragment
        if (busyInterval.start <= fragment.start && busyInterval.end < fragment.end) {
          nextFragments.push({
            ...fragment,
            start: busyInterval.end,
          })
          continue
        }

        // Busy overlaps the end of fragment
        if (busyInterval.start > fragment.start && busyInterval.end >= fragment.end) {
          nextFragments.push({
            ...fragment,
            end: busyInterval.start,
          })
          continue
        }

        // Busy is in the middle of fragment: split into two
        if (busyInterval.start > fragment.start && busyInterval.end < fragment.end) {
          nextFragments.push(
            {
              ...fragment,
              end: busyInterval.start,
            },
            {
              ...fragment,
              start: busyInterval.end,
            }
          )
          continue
        }
      }

      fragments = nextFragments
      if (fragments.length === 0) break
    }

    result.push(...fragments)
  }

  // Merge adjacent fragments that belong to the same block and are contiguous
  result.sort((a, b) => a.start.getTime() - b.start.getTime())

  const merged: AvailabilityRange[] = []
  for (const current of result) {
    const last = merged[merged.length - 1]
    if (
      last &&
      last.blockId === current.blockId &&
      last.isOneTime === current.isOneTime &&
      last.end.getTime() === current.start.getTime()
    ) {
      last.end = current.end
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}

/**
 * Generate available booking slots from availability ranges.
 * This can be used by student self-booking to show available times.
 * 
 * @param ranges - Available time ranges
 * @param slotDurationMinutes - Duration of each booking slot in minutes (default: 60)
 * @param bufferMinutes - Buffer time between slots (default: 0)
 * @returns Array of available slots
 */
export function generateAvailableSlots(
  ranges: AvailabilityRange[],
  slotDurationMinutes: number = 60,
  bufferMinutes: number = 0
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = []
  
  for (const range of ranges) {
    let slotStart = range.start
    
    while (true) {
      const slotEnd = addMinutes(slotStart, slotDurationMinutes)
      
      // Check if slot fits within the range
      if (slotEnd <= range.end) {
        slots.push({ start: slotStart, end: slotEnd })
        // Move to next potential slot (with buffer)
        slotStart = addMinutes(slotEnd, bufferMinutes)
      } else {
        break
      }
    }
  }
  
  return slots
}

/**
 * Filter out slots that conflict with existing bookings (lessons).
 * 
 * @param slots - Available slots to filter
 * @param bookedTimes - Array of booked time ranges (lessons)
 * @returns Slots that don't conflict with bookings
 */
export function filterConflictingSlots(
  slots: AvailabilitySlot[],
  bookedTimes: { start: Date; end: Date }[]
): AvailabilitySlot[] {
  return slots.filter((slot) => {
    // Check if this slot overlaps with any booked time
    const hasConflict = bookedTimes.some((booked) => {
      // Overlap occurs if: slotStart < bookedEnd AND slotEnd > bookedStart
      return slot.start < booked.end && slot.end > booked.start
    })
    return !hasConflict
  })
}

/**
 * Convert availability ranges to FullCalendar background events for visualization.
 * 
 * @param ranges - Availability ranges to convert
 * @returns Array of FullCalendar event objects
 */
export function toCalendarBackgroundEvents(
  ranges: AvailabilityRange[]
): Array<{
  id: string
  start: Date
  end: Date
  display: 'background'
  backgroundColor: string
  classNames: string[]
}> {
  return ranges.map((range, index) => ({
    id: `availability-${range.blockId}-${index}`,
    start: range.start,
    end: range.end,
    display: 'background' as const,
    backgroundColor: range.isOneTime ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.1)',
    classNames: [range.isOneTime ? 'one-time-availability' : 'weekly-availability'],
  }))
}

