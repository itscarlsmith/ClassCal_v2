import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardRouterPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  if (profile.role === 'teacher') {
    redirect('/teacher/dashboard')
  } else if (profile.role === 'student') {
    redirect('/student/dashboard')
  } else if (profile.role === 'parent') {
    redirect('/parent/dashboard')
  } else {
    redirect('/')
  }
}

