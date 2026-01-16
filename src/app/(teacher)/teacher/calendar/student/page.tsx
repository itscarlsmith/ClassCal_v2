'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addWeeks, subWeeks } from 'date-fns'
import {
  getAvailabilityRanges,
  subtractBusyFromAvailability,
  toCalendarBackgroundEvents,
  type BusyInterval,
} from '@/lib/availability'
import type { Lesson, Student, AvailabilityBlock } from '@/types/database'

type StudentLesson = Lesson

export default function StudentCalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const supabase = createClient()
  const { openDrawer } = useAppStore()

  const [currentTitle, setCurrentTitle] = useState('')
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>({
    start: subWeeks(new Date(), 1),
    end: addWeeks(new Date(), 1),
  })
  const [showTeacherAvailability, setShowTeacherAvailability] = useState(true)

  // Fetch current student and their teacher
  const { data: studentContext, isLoading: isContextLoading } = useQuery({
    queryKey: ['student-context'],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError || new Error('Not authenticated')

      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', userData.user.id)
        .single()

      if (error) throw error
      return student as Student
    },
  })

  // Fetch teacher availability blocks
  const { data: availability } = useQuery({
    queryKey: ['teacher-availability', studentContext?.teacher_id],
    queryFn: async () => {
      if (!studentContext?.teacher_id) return [] as AvailabilityBlock[]
      const { data, error } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('teacher_id', studentContext.teacher_id)

      if (error) throw error
      return data as AvailabilityBlock[]
    },
    enabled: !!studentContext?.teacher_id,
  })

  // Fetch lessons for this student (only their own, not other students)
  const { data: lessons } = useQuery({
    queryKey: ['student-lessons', studentContext?.id],
    queryFn: async () => {
      if (!studentContext?.id || !studentContext.teacher_id) return [] as StudentLesson[]

      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('teacher_id', studentContext.teacher_id)
        .eq('student_id', studentContext.id)
        .order('start_time')

      if (error) throw error
      return data as StudentLesson[]
    },
    enabled: !!studentContext?.id && !!studentContext?.teacher_id,
  })

  // Availability overlay for student (teacher availability minus student's own lessons)
  const availabilityEvents = useMemo(() => {
    if (!showTeacherAvailability) return []
    if (!availability || availability.length === 0) return []

    const availabilityRanges = getAvailabilityRanges(
      availability,
      visibleRange.start,
      visibleRange.end
    )

    const busyIntervals: BusyInterval[] =
      lessons
        ?.filter((lesson) => lesson.status !== 'cancelled')
        .map((lesson) => ({
          start: new Date(lesson.start_time),
          end: new Date(lesson.end_time),
        })) || []

    const freeRanges = subtractBusyFromAvailability(availabilityRanges, busyIntervals)
    return toCalendarBackgroundEvents(freeRanges)
  }, [availability, lessons, visibleRange, showTeacherAvailability])

  // Student's own lessons as foreground events
  const lessonEvents =
    lessons?.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      start: lesson.start_time,
      end: lesson.end_time,
      backgroundColor: '#DBEAFE',
      borderColor: '#3B82F6',
      textColor: '#1E3A8A',
      extendedProps: {
        lesson,
      },
    })) || []

  // Bookable slots for this student/teacher in the visible range
  type BookableSlot = { startTime: string; endTime: string }

  const { data: bookableSlots } = useQuery({
    queryKey: [
      'student-bookable-slots',
      studentContext?.teacher_id,
      visibleRange.start.toISOString(),
      visibleRange.end.toISOString(),
    ],
    queryFn: async () => {
      if (!studentContext?.teacher_id) return [] as BookableSlot[]
      const params = new URLSearchParams({
        start: visibleRange.start.toISOString(),
        end: visibleRange.end.toISOString(),
      })
      const res = await fetch(`/api/student/bookable-slots?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to load bookable slots')
      }
      const json = await res.json()
      return (json.slots || []) as BookableSlot[]
    },
    enabled: !!studentContext?.teacher_id,
  })

  const slotEvents =
    bookableSlots?.map((slot) => ({
      id: `slot-${slot.startTime}`,
      title: 'Available to book',
      start: slot.startTime,
      end: slot.endTime,
      backgroundColor: '#ECFDF5',
      borderColor: '#22C55E',
      textColor: '#166534',
      classNames: ['bookable-slot'],
      extendedProps: {
        type: 'slot',
        slotStart: slot.startTime,
        slotEnd: slot.endTime,
      },
    })) || []

  const events = [...lessonEvents, ...availabilityEvents, ...slotEvents]

  const handleEventClick = (info: EventClickArg) => {
    if (info.event.display === 'background') return

    const type = info.event.extendedProps.type as string | undefined

    if (type === 'slot') {
      const slotStart = info.event.extendedProps.slotStart as string | undefined
      const slotEnd = info.event.extendedProps.slotEnd as string | undefined
      if (!slotStart || !slotEnd || !studentContext) return

      openDrawer('booking', null, {
        slotStart,
        slotEnd,
        teacherId: studentContext.teacher_id,
        studentId: studentContext.id,
        studentCredits: studentContext.credits,
        studentName: studentContext.full_name,
      })
      return
    }

    const lesson = info.event.extendedProps.lesson as StudentLesson | undefined
    if (lesson) {
      openDrawer('lesson', lesson.id)
    }
  }

  const updateTitle = () => {
    const api = calendarRef.current?.getApi()
    if (api) {
      setCurrentTitle(api.view.title)
    }
  }

  const handlePrev = () => {
    const api = calendarRef.current?.getApi()
    api?.prev()
    updateTitle()
  }

  const handleNext = () => {
    const api = calendarRef.current?.getApi()
    api?.next()
    updateTitle()
  }

  const handleToday = () => {
    const api = calendarRef.current?.getApi()
    api?.today()
    updateTitle()
  }

  useEffect(() => {
    updateTitle()
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-card">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">My Teacher&apos;s Calendar</h1>
          <p className="text-sm text-muted-foreground">
            View your upcoming lessons and when your teacher is available
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="show-teacher-availability"
              checked={showTeacherAvailability}
              onCheckedChange={(checked) => setShowTeacherAvailability(checked === true)}
            />
            <label
              htmlFor="show-teacher-availability"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Show teacher availability
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-lg font-semibold min-w-[200px] text-center">
            {currentTitle}
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="h-full bg-card rounded-xl border border-border p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={false}
            events={events}
            editable={false}
            selectable={false}
            dayMaxEvents={true}
            weekends={true}
            nowIndicator={true}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            slotDuration="01:00:00"
            eventClick={handleEventClick}
            height="100%"
            datesSet={(arg: DatesSetArg) => {
              updateTitle()
              setVisibleRange({ start: arg.start, end: arg.end })
            }}
            eventContent={(eventInfo) => {
              if (eventInfo.event.display === 'background') return null
              return (
                <div className="p-1 overflow-hidden">
                  <div className="font-medium text-xs truncate">
                    {eventInfo.event.title}
                  </div>
                  <div className="text-[10px] opacity-75">
                    {format(eventInfo.event.start!, 'h:mm a')}
                  </div>
                </div>
              )
            }}
          />
        </div>
      </div>
    </div>
  )
}


