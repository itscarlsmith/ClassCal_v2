'use client'

import { RefObject, useEffect } from 'react'
import type FullCalendar from '@fullcalendar/react'

type UseFullCalendarAutosizeArgs = {
  calendarRef: RefObject<FullCalendar | null>
  containerRef: RefObject<HTMLElement | null>
}

/**
 * Keeps FullCalendar sized correctly when its container width changes
 * (e.g. while the sidebar collapses/expands). We use ResizeObserver to
 * detect container size updates and throttle FullCalendar's updateSize
 * calls to animation frames so we avoid spamming synchronous layout work.
 */
export function useFullCalendarAutosize({
  calendarRef,
  containerRef,
}: UseFullCalendarAutosizeArgs) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let frame: number | null = null
    const scheduleUpdate = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        calendarRef.current?.getApi()?.updateSize()
      })
    }

    // Update once on mount so the calendar matches the initial layout.
    scheduleUpdate()

    const observer = new ResizeObserver(() => {
      scheduleUpdate()
    })
    observer.observe(container)

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
      observer.disconnect()
    }
  }, [calendarRef, containerRef])
}
