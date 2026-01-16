'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export function useControlsVisibility({
  panelOpen,
  hideAfterMs = 3000,
}: {
  panelOpen: boolean
  hideAfterMs?: number
}) {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    if (panelOpen) return
    clearTimer()
    timerRef.current = setTimeout(() => {
      setVisible(false)
    }, hideAfterMs)
  }, [panelOpen, clearTimer, hideAfterMs])

  const handlePointerActivity = useCallback(() => {
    setVisible(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    if (panelOpen) {
      clearTimer()
    } else {
      scheduleHide()
    }

    return () => clearTimer()
  }, [panelOpen, scheduleHide, clearTimer])

  return {
    controlsVisible: panelOpen || visible,
    handlePointerActivity,
  }
}

export function useFullscreen(targetRef: RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  const updateState = useCallback(() => {
    setIsFullscreen(Boolean(document.fullscreenElement))
  }, [])

  useEffect(() => {
    document.addEventListener('fullscreenchange', updateState)
    return () => document.removeEventListener('fullscreenchange', updateState)
  }, [updateState])

  const enterFullscreen = useCallback(async () => {
    const el = targetRef.current || document.documentElement
    if (!el) return
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen()
    }
  }, [targetRef])

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen()
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await exitFullscreen()
    } else {
      await enterFullscreen()
    }
  }, [enterFullscreen, exitFullscreen])

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  }
}
