 'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const setUser = useAppStore((state) => state.setUser)

  // Load the authenticated user's profile into the global app store
  useEffect(() => {
    const supabase = createClient()
    let isCancelled = false

    const loadProfile = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) {
          const isSessionMissingError =
            (authError as any).name === 'AuthSessionMissingError' ||
            authError.message?.toLowerCase().includes('auth session missing')

          // Treat missing session as "no authenticated user" without logging a noisy error
          if (!isSessionMissingError) {
            console.error('Error loading auth user', authError)
          }

          if (!isCancelled) setUser(null)
          return
        }

        if (!user) {
          if (!isCancelled) setUser(null)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Error loading user profile', profileError)
          if (!isCancelled) setUser(null)
          return
        }

        if (!isCancelled) {
          setUser(profile)
        }
      } catch (error) {
        console.error('Unexpected error loading profile', error)
        if (!isCancelled) setUser(null)
      }
    }

    loadProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => {
      isCancelled = true
      subscription.unsubscribe()
    }
  }, [setUser])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

