// Stripe sends its sandbox payment events here (D-010: a caller outside the app,
// D-070). lib/payments/webhook.ts decides every answer; this file only reads the
// request, makes the confirm_payment RPC call with the secret key (sandbox payment
// confirmation flow §3 and §4.1, N7), and schedules STORY-16's confirmation email
// after answering 200 on confirmed holds (D-089). Route handlers run on the
// Node.js runtime by default, which node:crypto and nodemailer need.
import { after } from 'next/server'

import { sendHoldConfirmationEmail } from '@/lib/email/hold-confirmation'
import { handleStripeWebhook } from '@/lib/payments/webhook'
import { createAdminClient } from '@/lib/supabase/admin'

function log(message: string, details?: Record<string, unknown>) {
  console.warn(`[stripe webhook] ${message}`, details ?? {})
}

async function notifyConfirmedHold(reservationId: string, origin: string) {
  try {
    const admin = createAdminClient()
    const { data: reservation, error: reservationError } = await admin
      .from('reservations')
      .select('seeker_id, space_id, unit_label, wait_window_ends_at')
      .eq('id', reservationId)
      .maybeSingle()

    if (reservationError || !reservation) {
      log('Hold confirmation email skipped: reservation not found', {
        reservationId,
        error: reservationError?.message,
      })
      return
    }

    const [{ data: space, error: spaceError }, { data: userData, error: userError }] =
      await Promise.all([
        admin.from('spaces').select('name').eq('id', reservation.space_id).maybeSingle(),
        admin.auth.admin.getUserById(reservation.seeker_id),
      ])

    if (spaceError || !space) {
      log('Hold confirmation email skipped: space not found', {
        reservationId,
        spaceId: reservation.space_id,
        error: spaceError?.message,
      })
      return
    }

    if (userError) {
      log('Hold confirmation email skipped: failed to load Seeker', {
        reservationId,
        error: userError.message,
      })
      return
    }

    await sendHoldConfirmationEmail(
      {
        reservationId,
        spaceName: space.name,
        unitLabel: reservation.unit_label,
        waitWindowEndsAt: reservation.wait_window_ends_at,
        origin,
        recipientEmail: userData.user?.email ?? null,
      },
      { log },
    )
  } catch (error) {
    log('Hold confirmation email failed unexpectedly', {
      reservationId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
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
  const origin = new URL(request.url).origin

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
    onConfirmed: (reservationId) => {
      after(() => notifyConfirmedHold(reservationId, origin))
    },
  })

  return Response.json(result.body, { status: result.status })
}
