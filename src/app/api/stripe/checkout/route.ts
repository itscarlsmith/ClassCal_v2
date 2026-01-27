import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { getEffectiveHourlyRate } from '@/lib/pricing'

type CheckoutRequestBody = {
  teacherId?: string
  studentId?: string
  credits?: number
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
])

const toStripeAmount = (amount: number, currency: string) => {
  const normalized = currency.toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.has(normalized)) {
    return Math.round(amount)
  }
  return Math.round(amount * 100)
}

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

    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      return NextResponse.json(
        { error: 'Stripe checkout is available in test mode only.' },
        { status: 400 }
      )
    }

    let body: CheckoutRequestBody
    try {
      body = (await request.json()) as CheckoutRequestBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const teacherId = body.teacherId
    const studentId = body.studentId
    const credits = Number(body.credits)

    if (!teacherId || !studentId || !Number.isInteger(credits) || credits <= 0) {
      return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 })
    }

    const { data: studentRow, error: studentError } = await serviceSupabase
      .from('students')
      .select('id, teacher_id, hourly_rate')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (studentError) {
      console.error('Stripe checkout: student lookup failed', studentError)
      return NextResponse.json({ error: 'Unable to validate student' }, { status: 500 })
    }

    if (!studentRow || studentRow.teacher_id !== teacherId) {
      return NextResponse.json({ error: 'Student not linked to teacher' }, { status: 403 })
    }

    const { data: teacherSettings, error: settingsError } = await serviceSupabase
      .from('teacher_settings')
      .select(
        'teacher_id, default_hourly_rate, currency_code, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled'
      )
      .eq('teacher_id', teacherId)
      .maybeSingle()

    if (settingsError) {
      console.error('Stripe checkout: teacher settings lookup failed', settingsError)
      return NextResponse.json({ error: 'Unable to load teacher settings' }, { status: 500 })
    }

    if (
      !teacherSettings ||
      !teacherSettings.stripe_account_id ||
      !teacherSettings.stripe_charges_enabled ||
      !teacherSettings.stripe_payouts_enabled
    ) {
      return NextResponse.json(
        { error: 'Teacher has not completed payment setup' },
        { status: 400 }
      )
    }

    const currencyCode = (teacherSettings.currency_code || 'USD').toLowerCase()
    const effectiveRate = getEffectiveHourlyRate({
      studentHourlyRate: studentRow.hourly_rate,
      teacherDefaultHourlyRate: Number(teacherSettings.default_hourly_rate),
    })

    const unitAmount = toStripeAmount(effectiveRate, currencyCode)
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return NextResponse.json({ error: 'Invalid pricing configuration' }, { status: 400 })
    }

    const origin = new URL(request.url).origin
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currencyCode,
            unit_amount: unitAmount,
            product_data: {
              name: 'Lesson credits',
            },
          },
          quantity: credits,
        },
      ],
      metadata: {
        teacherId,
        studentId,
        credits: String(credits),
      },
      payment_intent_data: {
        on_behalf_of: teacherSettings.stripe_account_id,
        transfer_data: {
          destination: teacherSettings.stripe_account_id,
        },
      },
      success_url: `${origin}/student/finance?stripe=success`,
      cancel_url: `${origin}/student/finance?stripe=cancelled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
