import {
  format,
  formatDistance,
  formatRelative,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  isToday,
  isTomorrow,
  isYesterday,
  isPast,
  isFuture,
  isSameDay,
  isSameWeek,
  isSameMonth,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  parseISO,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from 'date-fns'

export {
  format,
  formatDistance,
  formatRelative,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  isToday,
  isTomorrow,
  isYesterday,
  isPast,
  isFuture,
  isSameDay,
  isSameWeek,
  isSameMonth,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  parseISO,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
}

// Format time for display (e.g., "2:30 PM")
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'h:mm a')
}

// Format date for display (e.g., "Dec 15, 2024")
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy')
}

// Format date and time (e.g., "Dec 15, 2024 at 2:30 PM")
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "MMM d, yyyy 'at' h:mm a")
}

// Format for calendar headers (e.g., "Monday, December 15")
export function formatDayHeader(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'EEEE, MMMM d')
}

// Format week range (e.g., "Dec 9 - 15, 2024")
export function formatWeekRange(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  const start = startOfWeek(d, { weekStartsOn: 1 })
  const end = endOfWeek(d, { weekStartsOn: 1 })
  
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`
  }
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
}

// Get relative time description
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  
  return formatDistance(d, new Date(), { addSuffix: true })
}

// Calculate lesson duration in minutes
export function getLessonDuration(start: Date | string, end: Date | string): number {
  const startDate = typeof start === 'string' ? parseISO(start) : start
  const endDate = typeof end === 'string' ? parseISO(end) : end
  return differenceInMinutes(endDate, startDate)
}

// Format duration (e.g., "1h 30m")
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

// Generate time slots for availability picker
export function generateTimeSlots(
  startHour: number = 8,
  endHour: number = 20,
  intervalMinutes: number = 30
): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = []
  let current = setMinutes(setHours(new Date(), startHour), 0)
  const end = setHours(new Date(), endHour)
  
  while (current <= end) {
    const value = format(current, 'HH:mm')
    const label = format(current, 'h:mm a')
    slots.push({ value, label })
    current = new Date(current.getTime() + intervalMinutes * 60000)
  }
  
  return slots
}

// Check if two time ranges overlap
export function doTimesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1
}

// Get day of week name
export function getDayName(dayIndex: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayIndex]
}

// Get short day name
export function getShortDayName(dayIndex: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[dayIndex]
}

