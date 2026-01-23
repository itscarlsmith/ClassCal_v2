import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'

export async function POST(request: Request) {
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
      .select('teacher_id, currency_code, country, stripe_account_id')
      .eq('teacher_id', user.id)
      .maybeSingle()

    if (settingsError) {
      console.error('Stripe connect: failed to load teacher settings', settingsError)
      return NextResponse.json({ error: 'Unable to load teacher settings' }, { status: 500 })
    }

    if (!teacherSettings) {
      return NextResponse.json(
        { error: 'Teacher settings are missing. Save your settings first.' },
        { status: 400 }
      )
    }

    const currencyCode = teacherSettings.currency_code?.toLowerCase()
    const countryCode = teacherSettings.country?.toUpperCase()

    if (!currencyCode || !countryCode) {
      return NextResponse.json(
        { error: 'Teacher currency and country are required for Stripe setup.' },
        { status: 400 }
      )
    }

    let stripeAccountId = teacherSettings.stripe_account_id

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: countryCode,
        default_currency: currencyCode,
      })
      stripeAccountId = account.id

      const { error: updateError } = await serviceSupabase
        .from('teacher_settings')
        .update({ stripe_account_id: stripeAccountId })
        .eq('teacher_id', user.id)

      if (updateError) {
        console.error('Stripe connect: failed to save account id', updateError)
        return NextResponse.json(
          { error: 'Unable to save Stripe account details' },
          { status: 500 }
        )
      }
    }

    const returnUrl = new URL('/teacher/stripe/return', request.url).toString()
    const refreshUrl = new URL('/teacher/settings', request.url).toString()

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    console.error('Stripe connect error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
