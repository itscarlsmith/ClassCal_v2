'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'

import { RemoteStage } from './remote-stage'
import { SelfViewThumbnail } from './self-view-thumbnail'
import { ChatSidebar } from './chat-sidebar'
import { CallControls } from './call-controls'
import { useControlsVisibility, useFullscreen } from './hooks'
import { Button } from '@/components/ui/button'

const joinPanelClassName =
  'flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-white/5 p-6 text-center shadow-2xl backdrop-blur'

interface LiveLessonCallProps {
  lessonId: string
}

type FetchState = 'idle' | 'loading' | 'error'

export function LiveLessonCall({ lessonId }: LiveLessonCallProps) {
  const [token, setToken] = useState<string | null>(null)
  const [state, setState] = useState<FetchState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [rightPanel, setRightPanel] = useState<'none' | 'chat' | 'materials'>('none')

  const livekitUrl = useMemo(() => process.env.NEXT_PUBLIC_LIVEKIT_URL, [])

  const stageRef = useRef<HTMLDivElement>(null)
  const { toggleFullscreen } = useFullscreen(stageRef)
  const panelOpen = rightPanel !== 'none'
  const { controlsVisible, handlePointerActivity } = useControlsVisibility({ panelOpen })

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
        const message =
          typeof errorValue === 'string' && errorValue.length > 0 ? errorValue : 'Unable to start the call.'
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
    setRightPanel('none')
    setState('idle')
  }, [])

  if (!livekitUrl) {
    return (
      <div className="flex min-h-[320px] flex-col gap-2 rounded-xl border border-border p-4">
        <p className="text-sm text-muted-foreground">
          LiveKit URL is not configured. Please set the <code className="font-mono">NEXT_PUBLIC_LIVEKIT_URL</code>{' '}
          environment variable.
        </p>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-black text-white">
        <div className={joinPanelClassName}>
          <div>
            <p className="text-xl font-semibold">Start the live lesson</p>
            <p className="text-sm text-white/70">Join the LiveKit room to start collaborating face-to-face.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleJoin} disabled={state === 'loading'} className="w-full">
            {state === 'loading' ? 'Connecting…' : 'Join video call'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black text-white"
      onMouseMove={handlePointerActivity}
      role="presentation"
    >
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        video
        audio
        onDisconnected={handleLeave}
        className="h-full w-full"
      >
        <RoomAudioRenderer />
        <div className="flex h-full w-full">
          <div className="relative flex-1">
            <RemoteStage ref={stageRef} onToggleFullscreen={toggleFullscreen} />
            <SelfViewThumbnail />

            <CallControls
              visible={controlsVisible}
              chatOpen={rightPanel === 'chat'}
              materialsOpen={rightPanel === 'materials'}
              onToggleChat={() =>
                setRightPanel((prev) => (prev === 'chat' ? 'none' : 'chat'))
              }
              onToggleMaterials={() =>
                setRightPanel((prev) => (prev === 'materials' ? 'none' : 'materials'))
              }
              onLeave={handleLeave}
            />
          </div>

          <ChatSidebar
            lessonId={lessonId}
            open={panelOpen}
            mode={rightPanel}
            onClose={() => setRightPanel('none')}
          />
        </div>
      </LiveKitRoom>
    </div>
  )
}
