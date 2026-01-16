import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const pageLayoutClassName =
  'min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-gradient-to-b from-background to-muted/40'
const primaryLinkClassName =
  'inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg'
const secondaryLinkClassName =
  'inline-flex h-12 items-center justify-center rounded-xl border border-input px-6 text-sm font-semibold text-foreground transition hover:bg-accent'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: 'teacher' | 'student' | 'parent' | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    role = (profile?.role as typeof role) ?? null
  }

  const teacherHref = role === 'teacher' ? '/teacher/dashboard' : '/teacher/login'
  const studentHref = role === 'student' ? '/student/dashboard' : '/student/login'

  return (
    <main className={pageLayoutClassName}>
      <div className="space-y-3 max-w-xl">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Welcome to ClassCal
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Choose how you want to continue
        </h1>
        <p className="text-muted-foreground">
          Teacher and student experiences are now available under dedicated
          routes. Pick the workspace you want to explore.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href={teacherHref}
          className={primaryLinkClassName}
        >
          Enter Teacher App
        </Link>
        <Link
          href={studentHref}
          className={secondaryLinkClassName}
        >
          Enter Student App
        </Link>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          {user
            ? `Signed in as ${user.email ?? 'member'}.`
            : 'You are not signed in yet.'}
        </p>
        {!user && (
          <Link
            href="/login"
            className="font-semibold text-primary hover:underline"
          >
            Log in
          </Link>
        )}
      </div>
    </main>
  )
}
