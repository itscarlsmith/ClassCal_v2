'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SyncState = 'loading' | 'success' | 'error'

export default function StripeReturnPage() {
  const router = useRouter()
  const [state, setState] = useState<SyncState>('loading')
  const [message, setMessage] = useState('Finalizing Stripe setup...')

  useEffect(() => {
    let isActive = true

    const syncStripe = async () => {
      try {
        const response = await fetch('/api/stripe/sync', { method: 'POST' })
        const payload = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to sync Stripe status')
        }
        if (!isActive) return
        setState('success')
        setMessage('Stripe setup updated. You can return to settings.')
      } catch (error) {
        if (!isActive) return
        const text = error instanceof Error ? error.message : 'Stripe setup failed'
        setState('error')
        setMessage(text)
      }
    }

    syncStripe()
    return () => {
      isActive = false
    }
  }, [])

  return (
    <div className="p-8 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Stripe Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex gap-3">
            <Button onClick={() => router.push('/teacher/settings')}>
              Back to Settings
            </Button>
            {state === 'error' && (
              <Button variant="outline" onClick={() => router.refresh()}>
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
