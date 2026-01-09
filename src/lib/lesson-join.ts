import { useEffect, useState } from 'react'

interface JoinWindowArgs {
  startTime: string | Date
  endTime: string | Date
  now?: Date
  graceMinutes?: number
}

const DEFAULT_GRACE_MINUTES = 5

export function isJoinWindowOpen({
  startTime,
  endTime,
  now = new Date(),
  graceMinutes = DEFAULT_GRACE_MINUTES,
}: JoinWindowArgs): boolean {
  const start = new Date(startTime)
  const end = new Date(endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false

  const graceMs = graceMinutes * 60 * 1000
  return now.getTime() >= start.getTime() - graceMs && now.getTime() <= end.getTime() + graceMs
}

export function useNow(tickMs = 30_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs)
    return () => clearInterval(id)
  }, [tickMs])

  return now
}

