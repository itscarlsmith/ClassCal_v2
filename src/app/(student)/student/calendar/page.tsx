'use client'

import { useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addWeeks, subWeeks } from 'date-fns'
import {
  getAvailabilityRanges,
  subtractBusyFromAvailability,
  toCalendarBackgroundEvents,
  type BusyInterval,
} from '@/lib/availability'
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { Lesson, AvailabilityBlock } from '@/types/database'
import { toast } from 'sonner'
import { isJoinWindowOpen } from '@/lib/lesson-join'
import { useNow } from '@/lib/lesson-join-client'
import { useFullCalendarAutosize } from '@/lib/use-fullcalendar-autosize'

type TeacherOption = {
  teacherId: string
  teacherName: string
  studentId: string
}

type BookableSlot = {
  startTime: string
  endTime: string
}

type StudentRow = {
  id: string
  teacher_id: string | null
}

type TeacherProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

type StudentRowWithTeacher = StudentRow & {
  teacher_profile: TeacherProfile | null
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: 'oklch(0.96 0.06 85)', border: 'transparent', text: 'oklch(0.45 0.08 70)' },
  confirmed: { bg: 'oklch(0.94 0.06 155)', border: 'transparent', text: 'oklch(0.35 0.1 155)' },
  completed: { bg: 'oklch(0.94 0.04 250)', border: 'transparent', text: 'oklch(0.4 0.08 250)' },
  cancelled: { bg: 'oklch(0.95 0.04 25)', border: 'transparent', text: 'oklch(0.5 0.1 25)' },
}

export default function StudentCalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { openDrawer } = useAppStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTeacherId = searchParams.get('teacher') || undefined
  const [currentTitle, setCurrentTitle] = useState('')
  const [visibleRange, setVisibleRange] = useState<{
    start: Date
    end: Date
  }>({
    start: subWeeks(new Date(), 1),
    end: addWeeks(new Date(), 1),
  })
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [showAvailability, setShowAvailability] = useState(true)

  useFullCalendarAutosize({ calendarRef, containerRef })

  const { data: studentRows, isLoading: isTeachersLoading } = useQuery<StudentRowWithTeacher[]>({
    queryKey: ['student-teachers'],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        throw userError || new Error('Not authenticated')
      }

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, teacher_id')
        .eq('user_id', userData.user.id)

      if (studentsError) throw studentsError
      const students = (studentsData || []) as StudentRow[]

      const teacherIds = Array.from(
        new Set(students.map((s) => s.teacher_id).filter((id): id is string => Boolean(id)))
      )

      let teacherProfiles: TeacherProfile[] = []
      if (teacherIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', teacherIds)
        if (profilesError) throw profilesError
        teacherProfiles = (profiles || []) as TeacherProfile[]
      }

      const teacherMap = new Map<string, TeacherProfile>()
      teacherProfiles.forEach((t) => teacherMap.set(t.id, t))

      return students.map((row) => ({
        ...row,
        teacher_profile: row.teacher_id ? teacherMap.get(row.teacher_id) || null : null,
      }))
    },
  })

  const teacherOptions = useMemo(() => {
    if (!studentRows) return []
    const seen = new Map<string, TeacherOption>()
    studentRows.forEach((row) => {
      if (!row.teacher_id || seen.has(row.teacher_id)) return
      seen.set(row.teacher_id, {
        teacherId: row.teacher_id,
        teacherName: row.teacher_profile?.full_name || 'Teacher',
        studentId: row.id,
      })
    })
    return Array.from(seen.values())
  }, [studentRows])

  const resolvedTeacherId = useMemo(() => {
    if (!teacherOptions.length) return null

    const requestedMatch = requestedTeacherId
      ? teacherOptions.find((t) => t.teacherId === requestedTeacherId)
      : undefined

    if (requestedMatch) {
      return requestedMatch.teacherId
    }

    if (selectedTeacherId && teacherOptions.some((t) => t.teacherId === selectedTeacherId)) {
      return selectedTeacherId
    }

    return teacherOptions[0].teacherId
  }, [teacherOptions, requestedTeacherId, selectedTeacherId])

  const selectedTeacher = useMemo(
    () => teacherOptions.find((option) => option.teacherId === resolvedTeacherId),
    [teacherOptions, resolvedTeacherId]
  )
  const selectedStudentId = selectedTeacher?.studentId
  const teacherDisplayName = selectedTeacher?.teacherName || 'Teacher'

  const { data: availabilityBlocks } = useQuery({
    queryKey: ['student-calendar-availability', resolvedTeacherId],
    enabled: !!resolvedTeacherId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('teacher_id', resolvedTeacherId)
      if (error) throw error
      return data as AvailabilityBlock[]
    },
  })

  const { data: lessons } = useQuery({
    queryKey: [
      'student-calendar-lessons',
      resolvedTeacherId,
      selectedStudentId,
      visibleRange.start.toISOString(),
      visibleRange.end.toISOString(),
    ],
    enabled: !!resolvedTeacherId && !!selectedStudentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('teacher_id', resolvedTeacherId)
        .eq('student_id', selectedStudentId)
        .gte('start_time', visibleRange.start.toISOString())
        .lte('end_time', visibleRange.end.toISOString())
        .order('start_time', { ascending: true })

      if (error) throw error
      return (data || []) as Lesson[]
    },
  })

  const { data: bookableSlots } = useQuery({
    queryKey: [
      'student-bookable-slots',
      resolvedTeacherId,
      visibleRange.start.toISOString(),
      visibleRange.end.toISOString(),
    ],
    enabled: !!resolvedTeacherId,
    queryFn: async () => {
      const params = new URLSearchParams({
        start: visibleRange.start.toISOString(),
        end: visibleRange.end.toISOString(),
        teacher: resolvedTeacherId || '',
      })
      const res = await fetch(`/api/student/bookable-slots?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to load bookable slots')
      }
      const json = await res.json()
      return (json.slots || []) as BookableSlot[]
    },
  })

  const availabilityRanges = useMemo(() => {
    if (!availabilityBlocks || !resolvedTeacherId) return []
    return getAvailabilityRanges(
      availabilityBlocks,
      visibleRange.start,
      visibleRange.end
    )
  }, [availabilityBlocks, resolvedTeacherId, visibleRange])

  const lessonEvents = useMemo(() => {
    if (!lessons) return []
    const visible = lessons.filter((lesson) =>
      ['pending', 'confirmed', 'completed'].includes(lesson.status)
    )
    return visible.map((lesson) => {
      const colors = statusColors[lesson.status] || statusColors.pending
      return {
        id: lesson.id,
        title: teacherDisplayName,
        start: lesson.start_time,
        end: lesson.end_time,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        extendedProps: {
          type: 'lesson',
          lessonId: lesson.id,
        },
      }
    })
  }, [lessons, teacherDisplayName])

  const slotEvents = useMemo(() => {
    if (!bookableSlots) return []
    return bookableSlots.map((slot) => ({
      id: `slot-${slot.startTime}`,
      title: 'Available to book',
      start: slot.startTime,
      end: slot.endTime,
      backgroundColor: 'oklch(0.95 0.05 155)',
      borderColor: 'transparent',
      textColor: 'oklch(0.38 0.1 155)',
      extendedProps: {
        type: 'slot',
        slotStart: slot.startTime,
        slotEnd: slot.endTime,
      },
    }))
  }, [bookableSlots])

  const availabilityEvents = useMemo(() => {
    if (!showAvailability) return []
    if (!availabilityRanges.length) return []

    const busyIntervals: BusyInterval[] =
      lessons?.filter((lesson) => lesson.status !== 'cancelled').map((lesson) => ({
        start: new Date(lesson.start_time),
        end: new Date(lesson.end_time),
      })) || []

    const freeRanges = subtractBusyFromAvailability(availabilityRanges, busyIntervals)
    return toCalendarBackgroundEvents(freeRanges)
  }, [availabilityRanges, lessons, showAvailability])

  const now = useNow(30_000)

  const events = useMemo(
    () =>
      showAvailability
        ? [...lessonEvents, ...slotEvents, ...availabilityEvents]
        : [...lessonEvents],
    [lessonEvents, slotEvents, availabilityEvents, showAvailability]
  )

  const handleDatesSet = (arg: DatesSetArg) => {
    setCurrentTitle(arg.view.title)
  }

  const handlePrev = () => {
    const api = calendarRef.current?.getApi()
    api?.prev()
  }

  const handleNext = () => {
    const api = calendarRef.current?.getApi()
    api?.next()
  }

  const handleToday = () => {
    const api = calendarRef.current?.getApi()
    api?.today()
  }

  const handleEventClick = (info: EventClickArg) => {
    if (info.event.display === 'background') return

    const type = info.event.extendedProps.type as string | undefined

    if (type === 'slot' && selectedTeacher && selectedStudentId) {
      openDrawer('student-booking', null, {
        slotStart: info.event.extendedProps.slotStart,
        slotEnd: info.event.extendedProps.slotEnd,
        teacherId: selectedTeacher.teacherId,
        teacherName: selectedTeacher.teacherName,
        studentId: selectedStudentId,
      })
      return
    }

    if (type === 'lesson') {
      const lessonId = info.event.extendedProps.lessonId as string | undefined
      if (lessonId) {
        openDrawer('student-lesson', lessonId)
      }
    }
  }

  const handleDateClick = (arg: DateClickArg) => {
    if (!showAvailability) return
    if (!bookableSlots || bookableSlots.length === 0) return
    if (!selectedTeacher || !selectedStudentId) return

    const clicked = arg.date

    const match = bookableSlots.find((slot) => {
      const start = new Date(slot.startTime)
      const end = new Date(slot.endTime)
      return clicked >= start && clicked < end
    })

    if (match) {
    openDrawer('student-booking', null, {
      slotStart: match.startTime,
      slotEnd: match.endTime,
      teacherId: selectedTeacher.teacherId,
      teacherName: selectedTeacher.teacherName,
      studentId: selectedStudentId,
    })
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-end px-8 py-5 border-b border-border/60">
        <div className="flex items-center gap-6">
          <div className="min-w-[200px]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5 font-medium">
              Teacher
            </p>
            <Select
              value={resolvedTeacherId || undefined}
              onValueChange={(value) => setSelectedTeacherId(value)}
              disabled={isTeachersLoading || teacherOptions.length === 0}
            >
              <SelectTrigger className="h-8 text-xs border-border/60 bg-background">
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent>
                {teacherOptions.map((teacher) => (
                  <SelectItem key={teacher.teacherId} value={teacher.teacherId}>
                    {teacher.teacherName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-sm font-medium text-foreground min-w-[180px] text-center">
            {currentTitle}
          </span>
          <div className="flex items-center gap-2.5">
            <Switch
              id="show-availability"
              checked={showAvailability}
              onCheckedChange={(checked) => setShowAvailability(checked === true)}
            />
            <label
              htmlFor="show-availability"
              className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
            >
              Show availability
            </label>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 px-6 pb-6 pt-2 overflow-auto">
        <div className="h-full">
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={false}
            events={events}
            editable={false}
            selectable={false}
            dayMaxEvents
            weekends
            nowIndicator
            slotMinTime="05:00:00"
            slotMaxTime="23:00:00"
            allDaySlot={false}
            slotDuration="01:00:00"
            height="100%"
            eventClick={handleEventClick}
            dateClick={handleDateClick}
          eventContent={(eventInfo) => {
            if (eventInfo.event.display === 'background') return null
            const type = eventInfo.event.extendedProps.type as string | undefined
            const isTimeGridView = eventInfo.view.type.startsWith('timeGrid')

            if (type === 'slot') {
              return (
                <div className="flex h-full flex-col gap-1 rounded-sm p-1.5 text-left">
                  <p className="text-sm font-medium leading-tight text-foreground truncate">
                    {eventInfo.event.title}
                  </p>
                  <Button
                    size="sm"
                    className="mt-auto h-6 w-full px-2 text-[11px]"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!selectedTeacher || !selectedStudentId) {
                        toast.error('Select a teacher to book this slot')
                        return
                      }
                      openDrawer('student-booking', null, {
                        slotStart: eventInfo.event.extendedProps.slotStart,
                        slotEnd: eventInfo.event.extendedProps.slotEnd,
                        teacherId: selectedTeacher.teacherId,
                        teacherName: selectedTeacher.teacherName,
                        studentId: selectedStudentId,
                      })
                    }}
                  >
                    Book
                  </Button>
                </div>
              )
            }

            const joinVisible =
              type === 'lesson' &&
              lessons?.some(
                (lesson) =>
                  lesson.id === eventInfo.event.id &&
                  lesson.status === 'confirmed' &&
                  isJoinWindowOpen({ startTime: lesson.start_time, endTime: lesson.end_time, now })
              )

            return (
              <div className="flex h-full w-full flex-col gap-1 rounded-sm p-1.5 text-left">
                <p className="text-sm font-medium leading-tight text-foreground truncate">
                  {eventInfo.event.title}
                </p>
                {joinVisible && isTimeGridView && (
                  <Button
                    size="sm"
                    className="mt-auto h-6 w-full px-2 text-[11px]"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      router.push(`/student/lessons/${eventInfo.event.id}/call`)
                    }}
                  >
                    Join
                  </Button>
                )}
              </div>
            )
          }}
            datesSet={(arg: DatesSetArg) => {
              handleDatesSet(arg)
              setVisibleRange({ start: arg.start, end: arg.end })
            }}
          />
        </div>
      </div>
    </div>
  )
}



