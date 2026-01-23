-- ===========================================================
-- 00022_stripe_connect_express.sql
-- Stripe Connect Express onboarding fields + webhook idempotency
-- ===========================================================

-- Extend teacher_settings with Stripe onboarding fields + country
ALTER TABLE public.teacher_settings
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Extend credit_ledger with Stripe payment intent tracking
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_stripe_payment_intent_unique
  ON public.credit_ledger (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Stripe webhook idempotency table
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Update teacher_settings SELECT policy to allow students to read their teacher's settings
DROP POLICY IF EXISTS "Teachers can view own settings" ON public.teacher_settings;
CREATE POLICY "Teachers and students can view settings" ON public.teacher_settings FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.teacher_id = teacher_settings.teacher_id
        AND s.user_id = auth.uid()
    )
  );
