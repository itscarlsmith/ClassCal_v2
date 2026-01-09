'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import {
  getAvailabilityRanges,
  toCalendarBackgroundEvents,
  subtractBusyFromAvailability,
  type BusyInterval,
} from '@/lib/availability'
import type { EventClickArg, DateSelectArg, EventDropArg, DatesSetArg } from '@fullcalendar/core'
import type { Lesson, Student, AvailabilityBlock } from '@/types/database'
import { isJoinWindowOpen, useNow } from '@/lib/lesson-join'
import { useRouter } from 'next/navigation'

type LessonWithStudent = Lesson & { student: Pick<Student, 'id' | 'full_name' | 'avatar_url'> }

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: 'oklch(0.96 0.06 85)', border: 'transparent', text: 'oklch(0.45 0.08 70)' },
  confirmed: { bg: 'oklch(0.94 0.06 155)', border: 'transparent', text: 'oklch(0.35 0.1 155)' },
  completed: { bg: 'oklch(0.94 0.04 250)', border: 'transparent', text: 'oklch(0.4 0.08 250)' },
  cancelled: { bg: 'oklch(0.95 0.04 25)', border: 'transparent', text: 'oklch(0.5 0.1 25)' },
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const { openDrawer, calendarView, setCalendarView, calendarDate, setCalendarDate, user } = useAppStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const [currentTitle, setCurrentTitle] = useState('')
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>({
    start: subMonths(new Date(), 1),
    end: addMonths(new Date(), 1),
  })
  const [showAvailability, setShowAvailability] = useState(true)

  // Fetch lessons
  const { data: lessons, isLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('lessons')
        .select('*, student:students(id, full_name, avatar_url)')
        .eq('teacher_id', userData.user?.id)
        .order('start_time')
      if (error) throw error
      return data as LessonWithStudent[]
    },
  })

  // Fetch availability blocks
  const { data: availability } = useQuery({
    queryKey: ['availability'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('teacher_id', userData.user?.id)
      if (error) throw error
      return data as AvailabilityBlock[]
    },
  })

  // Generate availability background events (availability minus existing lessons)
  const availabilityEvents = useMemo(() => {
    if (!showAvailability) return []
    if (!availability || availability.length === 0) return []
    if (!lessons || lessons.length === 0) {
      const rangesOnly = getAvailabilityRanges(
        availability,
        visibleRange.start,
        visibleRange.end
      )
      return toCalendarBackgroundEvents(rangesOnly)
    }

    const availabilityRanges = getAvailabilityRanges(
      availability,
      visibleRange.start,
      visibleRange.end
    )

    // Build busy intervals from all non-cancelled lessons that intersect the visible range
    const busyIntervals: BusyInterval[] = lessons
      .filter((lesson) => lesson.status !== 'cancelled')
      .map((lesson) => ({
        start: new Date(lesson.start_time),
        end: new Date(lesson.end_time),
      }))
      .filter(
        (interval) =>
          interval.end > visibleRange.start && interval.start < visibleRange.end
      )

    const freeRanges = subtractBusyFromAvailability(availabilityRanges, busyIntervals)
    return toCalendarBackgroundEvents(freeRanges)
  }, [availability, lessons, visibleRange, showAvailability])

  // Update lesson mutation via teacher API (for drag/drop/resize)
  const updateLessonMutation = useMutation({
    mutationFn: async ({
      id,
      start,
      end,
      revert,
    }: {
      id: string
      start: Date
      end: Date
      revert: () => void
    }) => {
      const res = await fetch(`/api/teacher/lessons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = json?.error || 'Failed to reschedule lesson'
        throw new Error(message)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      toast.success('Lesson rescheduled')
    },
    onError: (error, variables) => {
      if (variables.revert) variables.revert()
      const message = error instanceof Error ? error.message : 'Failed to reschedule lesson'
      toast.error(message)
    },
  })

  // Convert lessons to calendar events (hide cancelled)
  const visibleLessons =
    lessons?.filter((lesson) =>
      ['pending', 'confirmed', 'completed'].includes(lesson.status)
    ) || []

  const scheduleCountByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const lesson of visibleLessons) {
      const key = format(new Date(lesson.start_time), 'yyyy-MM-dd')
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [visibleLessons])

  const now = useNow(30_000)

  const lessonEvents = visibleLessons.map((lesson) => ({
    id: lesson.id,
    title: `${lesson.title} - ${lesson.student?.full_name}`,
    start: lesson.start_time,
    end: lesson.end_time,
    backgroundColor: statusColors[lesson.status]?.bg || statusColors.pending.bg,
    borderColor: statusColors[lesson.status]?.border || statusColors.pending.border,
    textColor: statusColors[lesson.status]?.text || statusColors.pending.text,
    extendedProps: {
      lesson,
    },
  }))

  // Combine lesson events and availability background events
  const events = [...lessonEvents, ...availabilityEvents]

  // Handle event click
  const handleEventClick = (info: EventClickArg) => {
    // Ignore background events (availability)
    if (info.event.display === 'background') return
    
    const lesson = info.event.extendedProps.lesson as LessonWithStudent
    if (lesson) {
      openDrawer('lesson', lesson.id)
    }
  }

  // Handle date selection (create new lesson)
  const handleDateSelect = (info: DateSelectArg) => {
    openDrawer('lesson', 'new', {
      startTime: info.start.toISOString(),
      endTime: info.end.toISOString(),
    })
  }

  // Handle event drop (reschedule)
  const handleEventDrop = (info: EventDropArg) => {
    const lesson = info.event.extendedProps.lesson as LessonWithStudent

    if (lesson.status === 'completed' || lesson.status === 'cancelled') {
      info.revert()
      toast.error('Cannot reschedule completed or cancelled lessons')
      return
    }

    updateLessonMutation.mutate({
      id: lesson.id,
      start: info.event.start!,
      end: info.event.end!,
      revert: () => info.revert(),
    })
  }

  // Navigation handlers
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

  const updateTitle = () => {
    const api = calendarRef.current?.getApi()
    if (api) {
      setCurrentTitle(api.view.title)
    }
  }

  // Update title on mount and view change
  useEffect(() => {
    updateTitle()
  }, [calendarView])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border/60">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Calendar</h1>
          <div className="flex items-center gap-0.5 bg-muted/60 rounded-full p-1">
            <Button
              variant={calendarView === 'dayGridMonth' ? 'secondary' : 'ghost'}
              size="sm"
              className={`rounded-full px-4 h-8 text-xs font-medium transition-all ${
                calendarView === 'dayGridMonth' 
                  ? 'bg-background shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              }`}
              onClick={() => {
                setCalendarView('dayGridMonth')
                calendarRef.current?.getApi().changeView('dayGridMonth')
                updateTitle()
              }}
            >
              Month
            </Button>
            <Button
              variant={calendarView === 'timeGridWeek' ? 'secondary' : 'ghost'}
              size="sm"
              className={`rounded-full px-4 h-8 text-xs font-medium transition-all ${
                calendarView === 'timeGridWeek' 
                  ? 'bg-background shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              }`}
              onClick={() => {
                setCalendarView('timeGridWeek')
                calendarRef.current?.getApi().changeView('timeGridWeek')
                updateTitle()
              }}
            >
              Week
            </Button>
            <Button
              variant={calendarView === 'timeGridDay' ? 'secondary' : 'ghost'}
              size="sm"
              className={`rounded-full px-4 h-8 text-xs font-medium transition-all ${
                calendarView === 'timeGridDay' 
                  ? 'bg-background shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              }`}
              onClick={() => {
                setCalendarView('timeGridDay')
                calendarRef.current?.getApi().changeView('timeGridDay')
                updateTitle()
              }}
            >
              Day
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
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
          <div className="flex items-center gap-5">
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
            <Button 
              className="h-8 px-4 rounded-full text-xs font-medium"
              onClick={() => openDrawer('lesson', 'new')}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Lesson
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-hidden px-6 pb-6 pt-2">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={calendarView}
          headerToolbar={false}
          events={events}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          nowIndicator={true}
          slotMinTime="05:00:00"
          slotMaxTime="23:00:00"
          allDaySlot={false}
          slotDuration="00:30:00"
          eventClick={handleEventClick}
          select={handleDateSelect}
          eventDrop={handleEventDrop}
          eventContent={(eventInfo) => {
            if (eventInfo.event.display === 'background') return null
            const lesson = eventInfo.event.extendedProps.lesson as LessonWithStudent | undefined
            const joinVisible =
              lesson &&
              lesson.status === 'confirmed' &&
              isJoinWindowOpen({ startTime: lesson.start_time, endTime: lesson.end_time, now })

            return (
              <div className="flex h-full w-full flex-col justify-between p-2 text-left">
                <div>
                  <p className="text-sm font-medium leading-tight">{eventInfo.event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(eventInfo.event.start!), 'h:mm a')} -{' '}
                    {format(new Date(eventInfo.event.end!), 'h:mm a')}
                  </p>
                </div>
                {joinVisible && lesson && (
                  <Button
                    size="sm"
                    className="mt-1"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      router.push(`/teacher/lessons/${lesson.id}/call`)
                    }}
                  >
                    Join
                  </Button>
                )}
              </div>
            )
          }}
          eventResize={(info) => {
            const lesson = info.event.extendedProps.lesson as LessonWithStudent
            if (lesson.status === 'completed' || lesson.status === 'cancelled') {
              info.revert()
              return
            }
            updateLessonMutation.mutate({
              id: lesson.id,
              start: info.event.start!,
              end: info.event.end!,
              revert: () => info.revert(),
            })
          }}
          height="100%"
          datesSet={(arg: DatesSetArg) => {
            updateTitle()
            setVisibleRange({ start: arg.start, end: arg.end })
          }}
          dayHeaderContent={(arg) => {
            if (arg.view.type === 'dayGridMonth') return null

            const key = format(arg.date, 'yyyy-MM-dd')
            const count = scheduleCountByDay.get(key) || 0

            return (
              <div className="flex flex-col items-center py-2">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {format(arg.date, 'EEE')}
                </div>
                <div className="text-lg font-medium text-foreground mt-0.5">
                  {format(arg.date, 'd')}
                </div>
                {count > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <span className="inline-block h-1 w-1 rounded-full bg-primary/60" />
                    <span>{count}</span>
                  </div>
                )}
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}

