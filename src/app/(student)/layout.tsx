import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { StudentSidebar } from '@/components/sidebar/student-sidebar'
import { GlobalUtilityBar } from '@/components/utility-bar/global-utility-bar'
import { DrawerManager } from '@/components/drawer/drawer-manager'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  if (profile.role !== 'student') {
    redirect('/teacher/dashboard')
  }

  if (user.email) {
    const serviceSupabase = await createServiceClient()
    const { error: linkError } = await serviceSupabase
      .from('students')
      .update({ user_id: user.id })
      .eq('email', user.email)
      .is('user_id', null)

    if (linkError) {
      console.error('Failed to link student account', linkError)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <StudentSidebar />
      <div className="flex-1 flex flex-col">
        <GlobalUtilityBar />
        <main className="flex-1 overflow-auto bg-muted/20">{children}</main>
      </div>
      <DrawerManager />
    </div>
  )
}



