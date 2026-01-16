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

type LessonWithStudent = Lesson & { student: Pick<Student, 'id' | 'full_name' | 'avatar_url'> }

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  confirmed: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
  completed: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
  cancelled: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const { openDrawer, calendarView, setCalendarView, calendarDate, setCalendarDate, user } = useAppStore()
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

  // Update lesson mutation
  const updateLessonMutation = useMutation({
    mutationFn: async ({ id, start, end }: { id: string; start: Date; end: Date }) => {
      const { error } = await supabase
        .from('lessons')
        .update({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      toast.success('Lesson rescheduled')
    },
    onError: () => {
      toast.error('Failed to reschedule lesson')
    },
  })

  // Convert lessons to calendar events
  const lessonEvents = lessons?.map((lesson) => ({
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
  })) || []

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
    <div className="h-full flex flex-col">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={calendarView === 'dayGridMonth' ? 'secondary' : 'ghost'}
              size="sm"
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
        
        <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-availability"
                checked={showAvailability}
                onCheckedChange={(checked) => setShowAvailability(checked === true)}
              />
              <label
                htmlFor="show-availability"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Show availability
              </label>
            </div>
            <Button onClick={() => openDrawer('lesson', 'new')}>
              <Plus className="w-4 h-4 mr-2" />
              New Lesson
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="h-full bg-card rounded-xl border border-border p-4">
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
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            slotDuration="00:30:00"
            eventClick={handleEventClick}
            select={handleDateSelect}
            eventDrop={handleEventDrop}
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
              })
            }}
            height="100%"
            datesSet={(arg: DatesSetArg) => {
              updateTitle()
              setVisibleRange({ start: arg.start, end: arg.end })
            }}
            eventContent={(eventInfo) => {
              // Don't render content for background events
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

