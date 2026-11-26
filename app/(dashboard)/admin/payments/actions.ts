'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import {
  createRefund,
  findRefund,
  StripeApiError,
  type AcceptedRefund,
} from '@/lib/payments/stripe'
import { createClient } from '@/lib/supabase/server'
import {
  refundPaymentSchema,
  type RefundPaymentActionState,
} from '@/lib/validation/admin'

const ALREADY_REFUNDED_MESSAGE = 'This payment is already refunded.'
const NOT_REFUNDABLE_MESSAGE = 'This payment is not eligible for a refund.'
const STRIPE_REFUSED_MESSAGE = "Stripe didn't accept the refund, so nothing changed."
const NOTHING_RECORDED_MESSAGE = 'Nothing was recorded. Try again.'
const UNAUTHORIZED_MESSAGE = 'You are not authorized to issue refunds.'

function isStripeClientRefusal(error: unknown): boolean {
  return error instanceof StripeApiError && error.status >= 400 && error.status < 500
}

/**
 * Server Action for Administrator sandbox refunds (STORY-14 design §1 & §3 Screen 3,
 * TSK-14.4, FR-5.3, P1, D-070, D-088).
 *
 * Strictly follows §1's sequence:
 * 1. Parse paymentId and reason with `refundPaymentSchema`.
 * 2. Verify signed-in session.
 * 3. Re-read the payment via `public.admin_payment_records` (recording lapses first).
 *    Only refundable paid payments reach Stripe.
 * 4. Call Stripe `createRefund` with `Idempotency-Key: refund-<paymentId>`.
 *    If Stripe refuses, fails, or times out, call `findRefund` to recover an earlier
 *    refund (e.g., after the 24h idempotency window).
 * 5. Record the accepted refund via `public.record_refund` and revalidate `/admin/payments`
 *    and `/seeker`.
 */
export async function refundPaymentAction(
  _prevState: RefundPaymentActionState,
  formData: FormData,
): Promise<RefundPaymentActionState> {
  const parsed = refundPaymentSchema.safeParse({
    paymentId: formData.get('paymentId'),
    reason: formData.get('reason'),
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    const reasonError = flattened.fieldErrors.reason?.[0]
    const paymentIdError = flattened.fieldErrors.paymentId?.[0]
    return {
      status: 'error',
      message: paymentIdError ?? null,
      fieldErrors: reasonError ? { reason: reasonError } : undefined,
    }
  }

  const { paymentId, reason } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnUrl=%2Fadmin%2Fpayments')

  // Step 1: Re-read the payment under current state (records lapses first, D-047).
  const { data: rows, error: readError } = await supabase.rpc('admin_payment_records', {
    p_payment_id: paymentId,
    p_page_size: 1,
    p_page_offset: 0,
  })

  if (readError) {
    const readErrText = `${readError.hint ?? ''} ${readError.message ?? ''}`
    if (readError.code === '42501' || readErrText.includes('permission denied')) {
      return { status: 'error', message: UNAUTHORIZED_MESSAGE }
    }
    return { status: 'error', message: NOTHING_RECORDED_MESSAGE }
  }

  const payment = rows?.[0]
  if (!payment) {
    revalidatePath('/admin/payments')
    return { status: 'error', message: NOT_REFUNDABLE_MESSAGE, reload: true }
  }

  if (payment.payment_status === 'refunded') {
    revalidatePath('/admin/payments')
    return { status: 'error', message: ALREADY_REFUNDED_MESSAGE, reload: true }
  }

  if (!payment.refundable || !payment.payment_intent_id) {
    revalidatePath('/admin/payments')
    return { status: 'error', message: NOT_REFUNDABLE_MESSAGE, reload: true }
  }

  // Step 2: Ask Stripe to refund the whole fee, falling back to findRefund on any error/timeout.
  let accepted: AcceptedRefund | null = null
  try {
    accepted = await createRefund({
      paymentIntentId: payment.payment_intent_id,
      paymentId,
    })
  } catch (createError) {
    const refused4xx = isStripeClientRefusal(createError)
    let recovered: AcceptedRefund | null = null
    try {
      recovered = await findRefund({
        paymentIntentId: payment.payment_intent_id,
      })
    } catch {
      // If findRefund fails or times out too, record nothing and tell the Admin to try again (D-088).
      return { status: 'error', message: NOTHING_RECORDED_MESSAGE }
    }

    if (recovered) {
      accepted = recovered
    } else {
      // Only a 4xx refusal or failed refund (with no earlier refund found) may say Stripe didn't accept it.
      return {
        status: 'error',
        message: refused4xx ? STRIPE_REFUSED_MESSAGE : NOTHING_RECORDED_MESSAGE,
      }
    }
  }

  // Step 3: Record the refund in Postgres (P1, D-088).
  const { error: recordError } = await supabase.rpc('record_refund', {
    p_payment_id: paymentId,
    p_refund_id: accepted.id,
    p_reason: reason,
  })

  if (recordError) {
    const errText = `${recordError.hint ?? ''} ${recordError.message ?? ''} ${recordError.details ?? ''}`

    if (errText.includes('already_refunded')) {
      revalidatePath('/admin/payments')
      return { status: 'error', message: ALREADY_REFUNDED_MESSAGE, reload: true }
    }

    if (errText.includes('not_refundable')) {
      revalidatePath('/admin/payments')
      return { status: 'error', message: NOT_REFUNDABLE_MESSAGE, reload: true }
    }

    if (errText.includes('invalid_reason')) {
      return {
        status: 'error',
        message: null,
        fieldErrors: { reason: 'Reason must be 300 characters or fewer.' },
      }
    }

    if (recordError.code === '42501' || errText.includes('permission denied')) {
      return { status: 'error', message: UNAUTHORIZED_MESSAGE }
    }

    return { status: 'error', message: NOTHING_RECORDED_MESSAGE }
  }

  revalidatePath('/admin/payments')
  revalidatePath('/seeker', 'layout')

  return {
    status: 'success',
    message: 'Refund recorded.',
    reload: true,
  }
}
