import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ParentLayout({
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

  if (profile.role !== 'parent') {
    redirect('/teacher/dashboard')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="w-64 border-r bg-muted/40 p-4">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
          Parent workspace
        </h2>
        <p className="mt-2 text-base font-semibold">ClassCal</p>
      </div>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

