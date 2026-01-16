import { CallSidebarBehavior } from '@/components/lesson/call-sidebar-behavior'
import { LiveLessonCall } from '@/components/lesson/live-call/live-lesson-call'

interface CallPageProps {
  params: Promise<{ id: string }>
}

export default async function StudentLessonCallPage({ params }: CallPageProps) {
  const { id } = await params

  return (
    <div className="h-full">
      <CallSidebarBehavior />
      <LiveLessonCall lessonId={id} />
    </div>
  )
}

