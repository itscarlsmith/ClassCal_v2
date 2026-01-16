'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient , useQuery } from '@tanstack/react-query'
import { Drawer, DrawerSection, DrawerFooter } from '../drawer'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { format, addMinutes } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

interface StudentBookingDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

export function StudentBookingDrawer({ id, data }: StudentBookingDrawerProps) {
  const { closeDrawer } = useAppStore()
  const queryClient = useQueryClient()
  const supabase = createClient()

  void id

  const slotStartIso = data?.slotStart as string | undefined
  const slotEndIso = data?.slotEnd as string | undefined
  const teacherId = data?.teacherId as string | undefined
  const teacherName = data?.teacherName as string | undefined
  const studentId = data?.studentId as string | undefined

  const [durationMinutes, setDurationMinutes] = useState<30 | 60>(60)
  const [half, setHalf] = useState<'first' | 'second'>('first')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')

  const slotStart = useMemo(
    () => (slotStartIso ? new Date(slotStartIso) : null),
    [slotStartIso]
  )

  const slotEnd = useMemo(
    () => (slotEndIso ? new Date(slotEndIso) : null),
    [slotEndIso]
  )

  const effectiveStart = useMemo(() => {
    if (!slotStart || !slotEnd) return null
    if (durationMinutes === 60) return slotStart
    // 30-minute lesson
    if (half === 'first') return slotStart
    // second half starts 30 minutes after slotStart
    return addMinutes(slotStart, 30)
  }, [slotStart, slotEnd, durationMinutes, half])

  const effectiveEnd = useMemo(() => {
    if (!slotStart || !slotEnd) return null
    if (durationMinutes === 60) return slotEnd
    // 30-minute lesson – end is 30 minutes after effectiveStart
    const start = half === 'first' ? slotStart : addMinutes(slotStart, 30)
    return addMinutes(start, 30)
  }, [slotStart, slotEnd, durationMinutes, half])

  const dateLabel = slotStart ? format(slotStart, 'EEEE, MMM d, yyyy') : ''
  const timeLabel =
    effectiveStart && effectiveEnd
      ? `${format(effectiveStart, 'h:mm a')} – ${format(effectiveEnd, 'h:mm a')}`
      : ''

  const { data: studentCredits } = useQuery({
    queryKey: ['student-credits', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, credits')
        .eq('id', studentId)
        .single()
      if (error) throw error
      return data
    },
  })

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!slotStartIso || !slotEndIso || !teacherId || !studentId) {
        throw new Error('Missing booking context')
      }

      if (!effectiveStart || !effectiveEnd) {
        throw new Error('Missing computed lesson time')
      }

      const payload = {
        slotStart: effectiveStart.toISOString(),
        slotEnd: effectiveEnd.toISOString(),
        durationMinutes,
        teacherId,
        studentId,
        title: title.trim() || undefined,
        note: note.trim() || undefined,
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const message = (json as { error?: string })?.error || 'Failed to book lesson.'
        throw new Error(message)
      }

      return json
    },
    onSuccess: () => {
      toast.success('Lesson booked!')
      queryClient.invalidateQueries({ queryKey: ['student-calendar-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['student-calendar-availability'] })
      queryClient.invalidateQueries({ queryKey: ['student-bookable-slots'] })
      queryClient.invalidateQueries({ queryKey: ['student-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      closeDrawer()
    },
    onError: (error: unknown) => {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to book lesson'

      let friendly = rawMessage
      if (rawMessage.toLowerCase().includes('not available')) {
        friendly = 'This time is outside your teacher’s available hours.'
      } else if (rawMessage.toLowerCase().includes('overlap') || rawMessage.toLowerCase().includes('conflict')) {
        friendly = 'This time conflicts with another lesson.'
      } else if (rawMessage.toLowerCase().includes('credit')) {
        friendly = 'You don’t have enough credits to book this lesson.'
      } else if (rawMessage.toLowerCase().includes('advance')) {
        friendly = 'Lessons must be booked further in advance.'
      }

      toast.error(friendly)
    },
  })

  if (!slotStart || !slotEnd || !teacherId || !studentId) {
    return (
      <Drawer
        title="Book Lesson"
        width="md"
        footer={
          <DrawerFooter>
            <Button variant="outline" onClick={closeDrawer}>
              Close
            </Button>
          </DrawerFooter>
        }
      >
        <p className="text-sm text-muted-foreground">
          Missing slot details. Please go back to the calendar and choose a time.
        </p>
      </Drawer>
    )
  }

  return (
    <Drawer
      title="Book Lesson"
      subtitle={`${teacherName || 'Teacher'} • ${dateLabel} • ${timeLabel}`}
      width="md"
      footer={
        <DrawerFooter>
          <Button variant="outline" onClick={closeDrawer}>
            Cancel
          </Button>
          <Button
            onClick={() => bookingMutation.mutate()}
            disabled={bookingMutation.isPending}
          >
            {bookingMutation.isPending ? 'Booking…' : 'Book Lesson'}
          </Button>
        </DrawerFooter>
      }
    >
      <div className="space-y-6">
        <DrawerSection title="Lesson Details">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Teacher</p>
              <p className="font-medium">{teacherName || 'Teacher'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Time</p>
              <p className="font-medium">
                {dateLabel} • {timeLabel}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Credits remaining</p>
              <p className="font-medium">
                {studentCredits?.credits ?? '—'}
              </p>
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Duration">
          <div className="flex gap-2">
            {[60, 30].map((option) => (
              <Button
                key={option}
                variant={durationMinutes === option ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setDurationMinutes(option as 30 | 60)
                  if (option === 60) {
                    setHalf('first')
                  }
                }}
                className="flex-1"
              >
                {option}-minute lesson
              </Button>
            ))}
          </div>

          {durationMinutes === 30 && slotStart && slotEnd && (
            <div className="mt-3 flex gap-2">
              {(['first', 'second'] as const).map((which) => {
                const start =
                  which === 'first' ? slotStart : addMinutes(slotStart, 30)
                const end = addMinutes(start, 30)
                const label = `${format(start, 'h:mm a')} – ${format(
                  end,
                  'h:mm a'
                )}`
                return (
                  <Button
                    key={which}
                    variant={half === which ? 'secondary' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setHalf(which)}
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          )}
        </DrawerSection>

        <DrawerSection title="Lesson Title">
          <Input
            placeholder={`Lesson with ${teacherName || 'your teacher'}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </DrawerSection>

        <DrawerSection title="Note to teacher">
          <Textarea
            placeholder="Add any context for the lesson (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </DrawerSection>
      </div>
    </Drawer>
  )
}

