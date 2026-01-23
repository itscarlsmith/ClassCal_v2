import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { constructStripeEvent, stripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

type CheckoutMetadata = {
  teacherId?: string
  studentId?: string
  credits?: string
}

async function syncStripeAccount(accountId: string) {
  const serviceSupabase = await createServiceClient()
  const account = await stripe.accounts.retrieve(accountId)

  const chargesEnabled = Boolean(account.charges_enabled)
  const payoutsEnabled = Boolean(account.payouts_enabled)

  const { error } = await serviceSupabase
    .from('teacher_settings')
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_onboarding_completed: chargesEnabled && payoutsEnabled,
    })
    .eq('stripe_account_id', accountId)

  if (error) {
    console.error('Stripe webhook: failed to sync account', error)
  }
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
    }

    const payload = await request.text()
    const event = constructStripeEvent(payload, signature)

    const serviceSupabase = await createServiceClient()
    const { error: webhookError } = await serviceSupabase
      .from('stripe_webhook_events')
      .insert({ id: event.id, type: event.type })

    if (webhookError?.code === '23505') {
      return NextResponse.json({ received: true })
    }

    if (webhookError) {
      console.error('Stripe webhook: failed to record event', webhookError)
      return NextResponse.json({ error: 'Unable to record webhook event' }, { status: 500 })
    }

    if (event.type === 'account.updated' || event.type === 'capability.updated') {
      const accountId =
        typeof event.account === 'string' ? event.account : event.account?.id ?? null
      if (accountId) {
        await syncStripeAccount(accountId)
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        metadata?: CheckoutMetadata
        payment_intent?: string | { id?: string }
      }

      const metadata = session.metadata || {}
      const teacherId = metadata.teacherId
      const studentId = metadata.studentId
      const credits = Number(metadata.credits)
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id

      if (!teacherId || !studentId || !Number.isFinite(credits) || credits <= 0) {
        console.error('Stripe webhook: invalid checkout metadata', metadata)
        return NextResponse.json({ error: 'Invalid checkout metadata' }, { status: 400 })
      }

      if (!paymentIntentId) {
        console.error('Stripe webhook: missing payment intent', session.payment_intent)
        return NextResponse.json({ error: 'Missing payment intent' }, { status: 400 })
      }

      const { error } = await serviceSupabase.from('credit_ledger').insert({
        student_id: studentId,
        teacher_id: teacherId,
        amount: credits,
        description: `Purchased ${credits} credits`,
        type: 'purchase',
        stripe_payment_intent_id: paymentIntentId,
      })

      if (error?.code !== '23505' && error) {
        console.error('Stripe webhook: failed to insert credit ledger', error)
        return NextResponse.json({ error: 'Unable to add credits' }, { status: 500 })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook error', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 })
  }
}
