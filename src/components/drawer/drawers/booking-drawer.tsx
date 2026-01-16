'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer, DrawerSection, DrawerFooter } from '../drawer'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface BookingDrawerProps {
  id: string | null
  data?: Record<string, unknown>
}

export function BookingDrawer({ id, data }: BookingDrawerProps) {
  const { closeDrawer } = useAppStore()
  const queryClient = useQueryClient()

  void id

  const slotStartIso = data?.slotStart as string | undefined
  const slotEndIso = data?.slotEnd as string | undefined
  const studentCredits = (data?.studentCredits as number | undefined) ?? 0
  const studentName = (data?.studentName as string | undefined) ?? 'Student'

  const [bookThirtyMinutes, setBookThirtyMinutes] = useState(false)

  const slotStart = useMemo(
    () => (slotStartIso ? new Date(slotStartIso) : null),
    [slotStartIso]
  )
  const slotEnd = useMemo(
    () => (slotEndIso ? new Date(slotEndIso) : null),
    [slotEndIso]
  )

  const effectiveEnd = useMemo(() => {
    if (!slotStart || !slotEnd) return null
    if (!bookThirtyMinutes) return slotEnd
    return new Date(slotStart.getTime() + 30 * 60 * 1000)
  }, [slotStart, slotEnd, bookThirtyMinutes])

  const durationMinutes = useMemo(() => {
    if (!slotStart || !effectiveEnd) return 0
    return (effectiveEnd.getTime() - slotStart.getTime()) / (60 * 1000)
  }, [slotStart, effectiveEnd])

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!slotStartIso || !slotEndIso) {
        throw new Error('Missing slot information')
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotStart: slotStartIso,
          slotEnd: slotEndIso,
          durationMinutes: durationMinutes || (bookThirtyMinutes ? 30 : 60),
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to book lesson')
      }

      return res.json()
    },
    onSuccess: () => {
      toast.success('Lesson booked!')
      // Refresh student lessons, teacher availability, and bookable slots
      queryClient.invalidateQueries({ queryKey: ['student-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-availability'] })
      queryClient.invalidateQueries({ queryKey: ['student-bookable-slots'] })
      closeDrawer()
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to book lesson'
      toast.error(message)
    },
  })

  if (!slotStart || !slotEnd) {
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
        <div className="p-6">
          <p className="text-sm text-muted-foreground">
            Missing booking information. Please close and try again.
          </p>
        </div>
      </Drawer>
    )
  }

  const dateLabel = format(slotStart, 'EEEE, MMM d, yyyy')
  const timeLabel = `${format(slotStart, 'h:mm a')} – ${format(
    effectiveEnd ?? slotEnd,
    'h:mm a'
  )}`

  return (
    <Drawer
      title="Book Lesson"
      subtitle={`${dateLabel} • ${timeLabel}`}
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
            {bookingMutation.isPending ? 'Booking…' : 'Confirm booking'}
          </Button>
        </DrawerFooter>
      }
    >
      <div className="space-y-6">
        <DrawerSection title="Lesson Details">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Student</p>
              <p className="font-medium">{studentName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Time</p>
              <p className="font-medium">{timeLabel}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">
                {durationMinutes || (bookThirtyMinutes ? 30 : 60)} minutes
              </p>
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Duration">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Default is a 60-minute lesson. You can also book a shorter
              30-minute lesson in this time slot.
            </p>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="book-thirty"
                checked={bookThirtyMinutes}
                onCheckedChange={(checked) =>
                  setBookThirtyMinutes(checked === true)
                }
              />
              <Label
                htmlFor="book-thirty"
                className="text-sm font-normal cursor-pointer"
              >
                Book a 30-minute lesson instead
              </Label>
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Credits">
          <div className="space-y-1">
            <p className="text-sm">
              You currently have{' '}
              <span className="font-semibold">{studentCredits}</span> credits.
            </p>
            <p className="text-sm text-muted-foreground">
              This booking will use <span className="font-semibold">1</span>{' '}
              credit when the lesson is marked as completed.
            </p>
          </div>
        </DrawerSection>
      </div>
    </Drawer>
  )
}


