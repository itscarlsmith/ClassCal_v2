'use client'

import { useMemo, forwardRef } from 'react'
import { Track } from 'livekit-client'
import { VideoTrack , useLocalParticipant, useTracks } from '@livekit/components-react'

import { cn } from '@/lib/utils'

interface RemoteStageProps {
  onToggleFullscreen?: () => void
}

export const RemoteStage = forwardRef<HTMLDivElement, RemoteStageProps>(function RemoteStage(
  { onToggleFullscreen },
  ref
) {
  const { localParticipant } = useLocalParticipant()
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true })

  const remoteCamera = useMemo(
    () => cameraTracks.find((t) => t.participant?.identity !== localParticipant?.identity),
    [cameraTracks, localParticipant?.identity]
  )

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden bg-black"
      onDoubleClick={onToggleFullscreen}
    >
      {remoteCamera ? (
        <VideoTrack
          trackRef={remoteCamera}
          className="h-full w-full object-cover"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-black text-sm text-white/80">
          Waiting for participant…
        </div>
      )}

      {/* Gradient at bottom for control readability */}
      <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/65 to-transparent')} />
    </div>
  )
})
