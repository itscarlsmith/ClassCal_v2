import { Sidebar } from '@/components/sidebar/sidebar'
import { DrawerManager } from '@/components/drawer/drawer-manager'
import { GlobalUtilityBar } from '@/components/utility-bar/global-utility-bar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
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

  if (profile.role !== 'teacher') {
    redirect('/student/dashboard')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <GlobalUtilityBar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <DrawerManager />
    </div>
  )
}

