'use client'

import { LessonChat } from '@/components/lesson/lesson-chat'
import { LessonMaterialsPanel } from '@/components/lesson/live-call/lesson-materials-panel'
import { cn } from '@/lib/utils'

interface ChatSidebarProps {
  lessonId: string
  open: boolean
  mode: 'none' | 'chat' | 'materials'
  onClose: () => void
}

export function ChatSidebar({ lessonId, open, mode, onClose }: ChatSidebarProps) {
  return (
    <div
      className={cn(
        'relative h-full overflow-hidden border-l border-white/10 bg-background/95 text-foreground shadow-xl backdrop-blur',
        'transition-[width] duration-300 ease-in-out',
        open ? 'w-[340px]' : 'w-0'
      )}
      aria-hidden={!open}
    >
      <div className={cn('flex h-full min-h-0 flex-col', !open && 'pointer-events-none')}>
        <div className="flex-1 min-h-0">
          {mode === 'materials' ? (
            <LessonMaterialsPanel lessonId={lessonId} onClose={onClose} />
          ) : (
            <LessonChat lessonId={lessonId} className="h-full" onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}
