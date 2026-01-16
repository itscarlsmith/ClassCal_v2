'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/app-store'

/**
 * Collapses the sidebar while a call page is active and restores the
 * previous state afterwards. Intended to be rendered once per call page.
 */
export function CallSidebarBehavior() {
  const { setSidebarCollapsed, sidebarCollapsed } = useAppStore()
  const initialStateRef = useRef<boolean>(sidebarCollapsed)

  useEffect(() => {
    const initialCollapsed = initialStateRef.current
    if (!initialCollapsed) {
      setSidebarCollapsed(true)
    }

    return () => {
      setSidebarCollapsed(initialCollapsed)
    }
  }, [setSidebarCollapsed])

  return null
}
