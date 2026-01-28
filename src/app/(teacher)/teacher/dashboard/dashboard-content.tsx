'use client'

import { useAppStore } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { format, isToday, isTomorrow } from 'date-fns'
import { 
  Users, 
  Calendar, 
  DollarSign, 
  MessageSquare, 
  BookOpen,
  Plus,
  ArrowRight,
  Clock,
  TrendingUp,
  CheckCircle,
} from 'lucide-react'
import Link from 'next/link'
import type { Profile, Lesson, Student } from '@/types/database'

interface DashboardContentProps {
  profile: Profile | null
  upcomingLessons: (Lesson & { student: Pick<Student, 'id' | 'full_name' | 'avatar_url'> })[]
  studentCount: number
  pendingHomework: number
  totalEarnings: number
  unreadMessages: number
}

export function DashboardContent({
  profile,
  upcomingLessons,
  studentCount,
  pendingHomework,
  totalEarnings,
  unreadMessages,
}: DashboardContentProps) {
  const { openDrawer } = useAppStore()

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRelativeDay = (date: Date) => {
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    return format(date, 'EEEE')
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-end">
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => openDrawer('student', 'new')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Student
          </Button>
          <Button onClick={() => openDrawer('lesson', 'new')}>
            <Plus className="w-4 h-4 mr-2" />
            Schedule Lesson
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="stat-value mt-2">{studentCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <Link 
              href="/teacher/students" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mt-4"
            >
              View all students
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Earnings</p>
                <p className="stat-value mt-2">${totalEarnings.toLocaleString()}</p>
                <span className="stat-trend-positive mt-2">
                  <TrendingUp className="w-3 h-3" />
                  12% vs last month
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">To Review</p>
                <p className="stat-value mt-2">{pendingHomework}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <Link 
              href="/teacher/homework/review" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mt-4"
            >
              Review homework
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unread Messages</p>
                <p className="stat-value mt-2">{unreadMessages}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <Link 
              href="/teacher/messages" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mt-4"
            >
              View messages
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Lessons */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold">Upcoming Lessons</CardTitle>
            <Link href="/teacher/calendar">
              <Button variant="ghost" size="sm">
                View Calendar
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingLessons.length > 0 ? (
              <div className="space-y-3">
                {upcomingLessons.map((lesson) => {
                  const lessonDate = new Date(lesson.start_time)
                  return (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => openDrawer('lesson', lesson.id)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={lesson.student?.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(lesson.student?.full_name || 'S')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{lesson.title}</p>
                          <Badge 
                            variant="secondary" 
                            className={
                              lesson.status === 'confirmed' ? 'badge-confirmed' : 'badge-pending'
                            }
                          >
                            {lesson.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          with {lesson.student?.full_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{getRelativeDay(lessonDate)}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(lessonDate, 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No upcoming lessons</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => openDrawer('lesson', 'new')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule a Lesson
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => openDrawer('student', 'new')}
              >
                <Users className="w-4 h-4 mr-3" />
                Add New Student
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => openDrawer('lesson', 'new')}
              >
                <Calendar className="w-4 h-4 mr-3" />
                Schedule Lesson
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => openDrawer('homework', 'new')}
              >
                <BookOpen className="w-4 h-4 mr-3" />
                Assign Homework
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => openDrawer('payment', 'new')}
              >
                <DollarSign className="w-4 h-4 mr-3" />
                Record Payment
              </Button>
            </CardContent>
          </Card>

          {/* Today's Summary */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Today&apos;s Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm">Lessons Today</span>
                  </div>
                  <span className="font-semibold">
                    {upcomingLessons.filter(l => isToday(new Date(l.start_time))).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-sm">Completed This Week</span>
                  </div>
                  <span className="font-semibold">8</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-sm">Homework Due</span>
                  </div>
                  <span className="font-semibold">{pendingHomework}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

