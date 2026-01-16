'use client'

import { useMemo } from 'react'
import { Track } from 'livekit-client'
import { VideoTrack , useLocalParticipant } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-core'
import { User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface SelfViewThumbnailProps {
  className?: string
  displayName?: string
  avatarUrl?: string | null
}

export function SelfViewThumbnail({ className, displayName = 'You', avatarUrl }: SelfViewThumbnailProps) {
  const { cameraTrack, isCameraEnabled, localParticipant } = useLocalParticipant()

  const trackRef: TrackReference | undefined = useMemo(() => {
    if (!cameraTrack) return undefined
    return {
      participant: localParticipant,
      publication: cameraTrack,
      source: cameraTrack.source ?? Track.Source.Camera,
    }
  }, [cameraTrack, localParticipant])

  const initials = useMemo(() => {
    const parts = displayName.trim().split(' ')
    if (parts.length === 0) return 'You'
    return parts
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [displayName])

  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-4 right-4 h-[150px] w-[200px] overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur',
        'transition-transform duration-200 hover:scale-[1.02]',
        className
      )}
    >
      {trackRef && isCameraEnabled ? (
        <VideoTrack
          trackRef={trackRef}
          className="h-full w-full object-cover"
          style={{ objectFit: 'cover' }}
          muted
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-900/70 text-white/80">
          <Avatar className="h-14 w-14 border border-white/10">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={displayName} />
            ) : (
              <AvatarFallback className="bg-slate-800 text-white">{initials || <User className="h-5 w-5" />}</AvatarFallback>
            )}
          </Avatar>
        </div>
      )}
    </div>
  )
}
