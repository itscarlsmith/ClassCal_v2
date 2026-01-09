import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { LessonVideoCall } from '@/components/lesson/lesson-video-call'
import { LessonChat } from '@/components/lesson/lesson-chat'
import { Button } from '@/components/ui/button'

interface CallPageProps {
  params: { id: string }
}

export default function TeacherLessonCallPage({ params }: CallPageProps) {
  const { id } = params

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/teacher/lessons">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Lessons
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold">Live lesson</h1>
        </div>
        <Link href="/teacher/calendar">
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

