'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'

import { CallControls } from '@/components/lesson/live-call/call-controls'
import { RemoteStage } from '@/components/lesson/live-call/remote-stage'
import { SelfViewThumbnail } from '@/components/lesson/live-call/self-view-thumbnail'
import { useControlsVisibility, useFullscreen } from '@/components/lesson/live-call/hooks'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LessonVideoCallProps {
  lessonId: string
  className?: string
}

type FetchState = 'idle' | 'loading' | 'error'

export function LessonVideoCall({ lessonId, className }: LessonVideoCallProps) {
  const [token, setToken] = useState<string | null>(null)
  const [state, setState] = useState<FetchState>('idle')
  const [error, setError] = useState<string | null>(null)

  const livekitUrl = useMemo(() => process.env.NEXT_PUBLIC_LIVEKIT_URL, [])
  const stageRef = useRef<HTMLDivElement>(null)
  const { toggleFullscreen } = useFullscreen(stageRef)
  const { controlsVisible, handlePointerActivity } = useControlsVisibility({ panelOpen: false })

  const handleJoin = useCallback(async () => {
    if (!lessonId) return
    if (!livekitUrl) {
      setError('LiveKit URL is not configured.')
      return
    }

    setState('loading')
    setError(null)

    try {
      const res = await fetch('/api/video/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lessonId }),
      })

      const json = await res.json().catch(() => ({}))

      const tokenValue = (json as Record<string, unknown>)?.token
      const errorValue = (json as Record<string, unknown>)?.error

      if (!res.ok || typeof tokenValue !== 'string' || tokenValue.length === 0) {
        const message = typeof errorValue === 'string' && errorValue.length > 0 ? errorValue : 'Unable to start the call.'
        throw new Error(message)
      }

      setToken(tokenValue)
      setState('idle')
    } catch (err) {
      console.error('Failed to join LiveKit room', err)
      setError(err instanceof Error ? err.message : 'Unable to start the call.')
      setState('error')
    }
  }, [lessonId, livekitUrl])

  const handleLeave = useCallback(() => {
    setToken(null)
    setState('idle')
  }, [])

  if (!livekitUrl) {
    return (
      <div className={cn('flex flex-col gap-2 rounded-xl border border-border p-4', className)}>
        <p className="text-sm text-muted-foreground">
          LiveKit URL is not configured. Please set the <code className="font-mono">NEXT_PUBLIC_LIVEKIT_URL</code>{' '}
          environment variable.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn('relative min-h-[320px] overflow-hidden rounded-xl border border-border bg-black text-white', className)}
      onMouseMove={handlePointerActivity}
      role="presentation"
    >
      {token ? (
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={token}
          video
          audio
          onDisconnected={handleLeave}
          className="h-full w-full"
        >
          <RoomAudioRenderer />
          <RemoteStage ref={stageRef} onToggleFullscreen={toggleFullscreen} />
          <SelfViewThumbnail />
          <CallControls
            visible={controlsVisible}
            chatOpen={false}
            materialsOpen={false}
            showChat={false}
            showMaterials={false}
            onToggleChat={() => undefined}
            onToggleMaterials={() => undefined}
            onLeave={handleLeave}
          />
        </LiveKitRoom>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <div>
            <p className="text-lg font-semibold">Start the live lesson</p>
            <p className="text-sm text-white/70">Join the LiveKit room to start collaborating face-to-face.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleJoin} disabled={state === 'loading'}>
            {state === 'loading' ? 'Connecting…' : 'Join video call'}
          </Button>
        </div>
      )}
    </div>
  )
}

