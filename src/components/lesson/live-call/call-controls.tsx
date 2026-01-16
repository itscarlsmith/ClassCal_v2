'use client'

import { FolderOpen, Monitor, MessageSquare, Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { Track } from 'livekit-client'
import { useRoomContext , useTrackToggle } from '@livekit/components-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CallControlsProps {
  visible: boolean
  chatOpen: boolean
  materialsOpen: boolean
  showChat?: boolean
  showMaterials?: boolean
  onToggleChat: () => void
  onToggleMaterials: () => void
  onLeave: () => void
}

export function CallControls({
  visible,
  chatOpen,
  materialsOpen,
  showChat = true,
  showMaterials = true,
  onToggleChat,
  onToggleMaterials,
  onLeave,
}: CallControlsProps) {
  const room = useRoomContext()

  const mic = useTrackToggle({ source: Track.Source.Microphone })
  const cam = useTrackToggle({ source: Track.Source.Camera })
  const screen = useTrackToggle({ source: Track.Source.ScreenShare })

  const handleLeave = async () => {
    try {
      await room.disconnect()
    } finally {
      onLeave()
    }
  }

  const controlButtonClass = 'h-10 w-10 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/15'
  const activeControlClass = 'bg-white/20'

  return (
    <div
      className={cn(
        'pointer-events-auto absolute inset-x-0 bottom-6 flex justify-center transition-all duration-200',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none translate-y-2'
      )}
    >
      <div className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 shadow-2xl backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void mic.toggle()}
          disabled={mic.pending}
          aria-pressed={mic.enabled}
          aria-label={mic.enabled ? 'Mute microphone' : 'Unmute microphone'}
          className={cn(controlButtonClass, mic.enabled && activeControlClass)}
        >
          {mic.enabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => void cam.toggle()}
          disabled={cam.pending}
          aria-pressed={cam.enabled}
          aria-label={cam.enabled ? 'Turn camera off' : 'Turn camera on'}
          className={cn(controlButtonClass, cam.enabled && activeControlClass)}
        >
          {cam.enabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => void screen.toggle()}
          disabled={screen.pending}
          aria-pressed={screen.enabled}
          aria-label={screen.enabled ? 'Stop sharing screen' : 'Share screen'}
          className={cn(controlButtonClass, screen.enabled && activeControlClass)}
        >
          <Monitor className="h-5 w-5" />
        </Button>

        {showChat && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleChat}
            aria-pressed={chatOpen}
            aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
            className={cn(controlButtonClass, chatOpen && activeControlClass)}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        )}

        {showMaterials && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMaterials}
            aria-pressed={materialsOpen}
            aria-label={materialsOpen ? 'Hide materials' : 'Show materials'}
            className={cn(controlButtonClass, materialsOpen && activeControlClass)}
          >
            <FolderOpen className="h-5 w-5" />
          </Button>
        )}

        <Button
          variant="destructive"
          size="icon"
          onClick={() => void handleLeave()}
          aria-label="Leave call"
          className="h-10 w-10 rounded-full"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
