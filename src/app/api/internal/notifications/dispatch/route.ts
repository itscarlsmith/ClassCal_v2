import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

const BATCH_SIZE = 50
const MAX_ATTEMPTS = 10

function requireSecret(request: Request) {
  const expected = process.env.NOTIFICATIONS_DISPATCH_SECRET
  if (!expected) return { ok: false, reason: 'Missing NOTIFICATIONS_DISPATCH_SECRET' }
  const actual = request.headers.get('x-notifications-secret')
  if (!actual || actual !== expected) return { ok: false, reason: 'Unauthorized' }
  return { ok: true }
}

function getBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ''
  )
}

function toAbsoluteUrl(pathOrUrl: string) {
  if (!pathOrUrl) return pathOrUrl
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl
  }
  const base = getBaseUrl().replace(/\/$/, '')
  if (!base) return pathOrUrl
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

function buildHtml(body: string, ctaUrl: string) {
  const safeBody = body || 'You have a new notification.'
  const resolvedUrl = toAbsoluteUrl(ctaUrl) || '#'
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <p>${safeBody}</p>
      <p>
        <a href="${resolvedUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px">
          View in ClassCal
        </a>
      </p>
    </div>
  `
}

export async function POST(request: Request) {
  const auth = requireSecret(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!resendApiKey || !fromEmail) {
    return NextResponse.json(
      { error: 'Missing RESEND_API_KEY or RESEND_FROM_EMAIL' },
      { status: 500 }
    )
  }

  const supabase = await createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: pending, error: pendingError } = await supabase
    .from('notification_email_outbox')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('scheduled_for', nowIso)
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE)

  if (pendingError) {
    console.error('Failed to load notification outbox', pendingError)
    return NextResponse.json({ error: 'Failed to load outbox' }, { status: 500 })
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const resend = new Resend(resendApiKey)
  const lockedBy = `dispatch-${crypto.randomUUID()}`
  let processed = 0

  for (const item of pending) {
    const { data: locked } = await supabase
      .from('notification_email_outbox')
      .update({
        status: 'sending',
        locked_at: new Date().toISOString(),
        locked_by: lockedBy,
      })
      .eq('id', item.id)
      .in('status', ['pending', 'failed'])
      .select()
      .maybeSingle()

    if (!locked) continue

    const ctaUrl = toAbsoluteUrl(locked.cta_url || '')
    try {
      await resend.emails.send({
        from: fromEmail,
        to: locked.to_email,
        subject: locked.subject,
        text: locked.text_body,
        html: buildHtml(locked.text_body, ctaUrl),
      })

      await supabase
        .from('notification_email_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
        })
        .eq('id', locked.id)

      processed += 1
    } catch (error) {
      const attemptCount = (locked.attempt_count ?? 0) + 1
      const backoffMinutes = Math.min(60, Math.pow(2, attemptCount))
      const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
      const message = error instanceof Error ? error.message : 'Unknown error'

      console.error('Failed to send notification email', {
        id: locked.id,
        to: locked.to_email,
        attemptCount,
        error: message,
      })

      await supabase
        .from('notification_email_outbox')
        .update({
          status: 'failed',
          attempt_count: attemptCount,
          last_error: message,
          scheduled_for: nextAttempt,
          locked_at: null,
          locked_by: null,
        })
        .eq('id', locked.id)
    }
  }

  return NextResponse.json({ processed })
}
