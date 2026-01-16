import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { LessonVideoCall } from '@/components/lesson/lesson-video-call'
import { LessonChat } from '@/components/lesson/lesson-chat'
import { Button } from '@/components/ui/button'
import { CallSidebarBehavior } from '@/components/lesson/call-sidebar-behavior'

interface CallPageProps {
  params: Promise<{ id: string }>
}

export default async function StudentLessonCallPage({ params }: CallPageProps) {
  const { id } = await params

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <CallSidebarBehavior />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/student/lessons">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Lessons
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold">Live lesson</h1>
        </div>
        <Link href="/student/calendar">
          <Button variant="outline" size="sm">
            Back to calendar
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LessonVideoCall lessonId={id} className="h-[520px]" />
        <LessonChat lessonId={id} className="h-[520px]" />
      </div>
    </div>
  )
}

