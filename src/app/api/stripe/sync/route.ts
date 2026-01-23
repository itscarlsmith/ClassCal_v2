import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const serviceSupabase = await createServiceClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: teacherSettings, error: settingsError } = await serviceSupabase
      .from('teacher_settings')
      .select('teacher_id, stripe_account_id')
      .eq('teacher_id', user.id)
      .maybeSingle()

    if (settingsError) {
      console.error('Stripe sync: failed to load teacher settings', settingsError)
      return NextResponse.json({ error: 'Unable to load teacher settings' }, { status: 500 })
    }

    if (!teacherSettings?.stripe_account_id) {
      return NextResponse.json({ error: 'Stripe account not connected' }, { status: 400 })
    }

    const account = await stripe.accounts.retrieve(teacherSettings.stripe_account_id)
    const chargesEnabled = Boolean(account.charges_enabled)
    const payoutsEnabled = Boolean(account.payouts_enabled)

    const { error: updateError } = await serviceSupabase
      .from('teacher_settings')
      .update({
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_onboarding_completed: chargesEnabled && payoutsEnabled,
      })
      .eq('teacher_id', user.id)

    if (updateError) {
      console.error('Stripe sync: failed to update flags', updateError)
      return NextResponse.json({ error: 'Unable to update Stripe status' }, { status: 500 })
    }

    return NextResponse.json({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_onboarding_completed: chargesEnabled && payoutsEnabled,
    })
  } catch (error) {
    console.error('Stripe sync error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
