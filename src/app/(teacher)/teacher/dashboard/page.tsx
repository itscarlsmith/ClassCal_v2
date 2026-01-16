import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from './dashboard-content'

const NOW = Date.now()
const UPCOMING_END_ISO = new Date(NOW + 7 * 24 * 60 * 60 * 1000).toISOString()
const RECENT_PAYMENTS_START_ISO = new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString()

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()
  
  // Fetch upcoming lessons (next 7 days)
  const { data: upcomingLessons, error: upcomingLessonsError } = await supabase
    .from('lessons')
    .select('*, student:students!lessons_student_id_fkey(id, full_name, avatar_url)')
    .eq('teacher_id', user?.id)
    .gte('start_time', new Date().toISOString())
    .lte('start_time', UPCOMING_END_ISO)
    .order('start_time', { ascending: true })
    .limit(5)
  const safeUpcomingLessons =
    upcomingLessonsError || !upcomingLessons ? [] : upcomingLessons
  
  // Fetch student count
  const { count: studentCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', user?.id)
  
  // Fetch pending homework
  const { count: pendingHomework } = await supabase
    .from('homework')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', user?.id)
    .eq('status', 'submitted')
  
  // Fetch recent payments (last 30 days)
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('amount')
    .eq('teacher_id', user?.id)
    .eq('status', 'completed')
    .gte('created_at', RECENT_PAYMENTS_START_ISO)
  
  const totalEarnings = recentPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
  
  // Fetch unread messages
  const { count: unreadMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user?.id)
    .eq('is_read', false)

  if (upcomingLessonsError) {
    console.error('Failed to load upcoming lessons', upcomingLessonsError)
  }

  return (
    <DashboardContent
      profile={profile}
      upcomingLessons={safeUpcomingLessons}
      studentCount={studentCount || 0}
      pendingHomework={pendingHomework || 0}
      totalEarnings={totalEarnings}
      unreadMessages={unreadMessages || 0}
    />
  )
}

