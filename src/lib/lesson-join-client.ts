'use client'

import { useEffect, useState } from 'react'

export function useNow(tickMs = 30_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs)
    return () => clearInterval(id)
  }, [tickMs])

  return now
}

