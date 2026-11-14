// Stripe sends its sandbox payment events here (D-010: a caller outside the app,
// D-070). lib/payments/webhook.ts decides every answer; this file only reads the
// request and makes the one database call it needs, confirm_payment, with the secret
// key (sandbox payment confirmation flow §3 and §4.1, N7). Route handlers run on the
// Node.js runtime by default, which node:crypto needs.
import { handleStripeWebhook } from '@/lib/payments/webhook'
import { createAdminClient } from '@/lib/supabase/admin'

function log(message: string, details?: Record<string, unknown>) {
  console.warn(`[stripe webhook] ${message}`, details ?? {})
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    // 500, so Stripe keeps the event and retries once the setting is fixed.
    log('STRIPE_WEBHOOK_SECRET is not set')
    return Response.json({ error: 'not_configured' }, { status: 500 })
  }

  // The signature covers the exact bytes, so read the body as text, never as JSON.
  const rawBody = await request.text()

  const result = await handleStripeWebhook({
    rawBody,
    signatureHeader: request.headers.get('stripe-signature'),
    secret,
    nowSeconds: Math.floor(Date.now() / 1000),
    confirmPayment: async ({ reservationId, checkoutSessionId, externalPaymentId }) => {
      const { data, error } = await createAdminClient().rpc('confirm_payment', {
        p_reservation_id: reservationId,
        p_checkout_session_id: checkoutSessionId,
        p_external_payment_id: externalPaymentId,
      })
      if (error) throw new Error(`${error.code ?? 'error'}: ${error.message}`)
      return data
    },
    log,
  })

  return Response.json(result.body, { status: result.status })
}
