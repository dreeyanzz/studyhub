// The Stripe half of a take-down (V7), or of rejecting an edited Space (V3): the database
// can't call Stripe, so public.set_space_status cancels the holds (R13, R14) and returns
// them, and this closes each cancelled hold's open checkout and refunds each paid fee
// through STORY-14's refund code (STORY-20 design §2, D-085, D-088). Server only: it
// calls Stripe with the secret key. setSpaceStatusAction calls it (TSK-20.3).
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'

import {
  createRefund,
  expireCheckoutSession,
  findRefund,
  type AcceptedRefund,
} from './stripe'

/** One hold public.set_space_status cancelled, as its `cancelled_holds` lists it. */
export interface CancelledHold {
  reservationId: string
  previousStatus: 'pending_payment' | 'reserved'
  paymentId: string
  paymentStatus: Database['public']['Enums']['payment_status']
  checkoutSessionId: string | null
  /** `payments.external_payment_id`, the PaymentIntent a refund needs (D-070). */
  paymentIntentId: string | null
}

export type TakeDownAction = 'taken_down' | 'rejected'

export interface TakeDownCleanup {
  expiredCheckouts: number
  refundedCount: number
  /** Still `paid`: an Administrator retries each on /admin/payments (D-085). */
  failedRefundPaymentIds: string[]
}

/** Only ids and short reasons, never a secret. */
export type CleanupLog = (message: string, details?: Record<string, unknown>) => void

const defaultLog: CleanupLog = (message, details) =>
  console.warn(`[take-down] ${message}`, details ?? {})

export interface CleanupDeps {
  createRefund?: typeof createRefund
  findRefund?: typeof findRefund
  expireCheckoutSession?: typeof expireCheckoutSession
  log?: CleanupLog
}

/** payments.refund_reason holds 1 to 300 characters (D-088). */
export const REFUND_REASON_MAX_LENGTH = 300

/**
 * The refund's reason, from the move and the Administrator's reason: "Space taken
 * down: …" or "Space rejected after an edit: …", cut to 300 characters. It counts code
 * points, as Postgres's char_length does, so an emoji is never cut in half.
 */
export function takeDownRefundReason(action: TakeDownAction, reason: string): string {
  const prefix =
    action === 'taken_down' ? 'Space taken down' : 'Space rejected after an edit'
  const trimmed = reason.trim()
  const text = trimmed ? `${prefix}: ${trimmed}` : prefix
  const chars = Array.from(text)
  if (chars.length <= REFUND_REASON_MAX_LENGTH) return text
  return `${chars.slice(0, REFUND_REASON_MAX_LENGTH - 1).join('')}…`
}

const holdShape = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/**
 * Reads `cancelled_holds` from public.set_space_status's answer. Throws on anything
 * else, because a hold it skipped would keep a fee nobody refunds.
 */
export function parseCancelledHolds(result: unknown): CancelledHold[] {
  const list = holdShape(result) ? result.cancelled_holds : undefined
  if (!Array.isArray(list))
    throw new Error('set_space_status answered without cancelled_holds')

  return list.map((hold) => {
    if (!holdShape(hold)) throw new Error('A cancelled hold is not an object')
    const reservationId = text(hold.reservation_id)
    const paymentId = text(hold.payment_id)
    const previousStatus = hold.previous_status
    const paymentStatus = hold.payment_status
    if (
      !reservationId ||
      !paymentId ||
      (previousStatus !== 'pending_payment' && previousStatus !== 'reserved') ||
      (paymentStatus !== 'pending' &&
        paymentStatus !== 'paid' &&
        paymentStatus !== 'forfeited' &&
        paymentStatus !== 'refunded')
    ) {
      throw new Error('A cancelled hold is missing its ids or statuses')
    }
    return {
      reservationId,
      previousStatus,
      paymentId,
      paymentStatus,
      checkoutSessionId: text(hold.checkout_session_id),
      paymentIntentId: text(hold.payment_intent_id),
    }
  })
}

/**
 * Closes the open checkout of each cancelled Pending Payment hold, and refunds the fee of
 * each cancelled Reserved hold (R13, R14, P1). Nothing here throws:
 * - a checkout that won't close is logged, because Stripe expires it anyway and a late
 *   payment is P2, refundable from /admin/payments;
 * - a refund Stripe doesn't accept, or one it accepted that record_refund didn't record,
 *   leaves its payment `paid`, and its id comes back in `failedRefundPaymentIds`.
 */
export async function cleanupTakeDownHolds(
  supabase: SupabaseClient<Database>,
  cancelledHolds: CancelledHold[],
  reason: string,
  action: TakeDownAction,
  deps: CleanupDeps = {},
): Promise<TakeDownCleanup> {
  const refund = deps.createRefund ?? createRefund
  const find = deps.findRefund ?? findRefund
  const expire = deps.expireCheckoutSession ?? expireCheckoutSession
  const log = deps.log ?? defaultLog
  const refundReason = takeDownRefundReason(action, reason)

  const result: TakeDownCleanup = {
    expiredCheckouts: 0,
    refundedCount: 0,
    failedRefundPaymentIds: [],
  }

  for (const hold of cancelledHolds) {
    if (hold.previousStatus === 'pending_payment') {
      if (!hold.checkoutSessionId || hold.paymentStatus !== 'pending') continue
      try {
        await expire(hold.checkoutSessionId)
        result.expiredCheckouts += 1
      } catch (error) {
        log('could not close the checkout of a cancelled hold', {
          reservationId: hold.reservationId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
      continue
    }

    // A Reserved hold has paid (R2). Only a paid fee is refunded, once (D-088).
    if (hold.paymentStatus !== 'paid') continue
    if (!hold.paymentIntentId) {
      log('a paid hold has no PaymentIntent to refund', { paymentId: hold.paymentId })
      result.failedRefundPaymentIds.push(hold.paymentId)
      continue
    }

    const accepted = await refundOnce(hold, refund, find, log)
    if (!accepted) {
      result.failedRefundPaymentIds.push(hold.paymentId)
      continue
    }

    const { error } = await supabase.rpc('record_refund', {
      p_payment_id: hold.paymentId,
      p_refund_id: accepted.id,
      p_reason: refundReason,
    })
    if (
      !error ||
      `${error.hint ?? ''} ${error.message ?? ''}`.includes('already_refunded')
    ) {
      // already_refunded: another Administrator recorded this refund first.
      result.refundedCount += 1
    } else {
      log('Stripe refunded a fee that was not recorded', {
        paymentId: hold.paymentId,
        refundId: accepted.id,
        code: error.code,
        hint: error.hint,
      })
      result.failedRefundPaymentIds.push(hold.paymentId)
    }
  }

  return result
}

/**
 * Asks Stripe for the whole fee back, with one Idempotency-Key per payment. On any
 * refusal, failure or timeout it looks for an earlier refund that succeeded or is
 * pending, as STORY-14's refund does (design §1, D-088), and gives up only when that
 * finds none or fails too.
 */
async function refundOnce(
  hold: CancelledHold,
  refund: typeof createRefund,
  find: typeof findRefund,
  log: CleanupLog,
): Promise<AcceptedRefund | null> {
  const paymentIntentId = hold.paymentIntentId as string
  try {
    return await refund({ paymentIntentId, paymentId: hold.paymentId })
  } catch (createError) {
    try {
      const earlier = await find({ paymentIntentId })
      if (earlier) return earlier
      log('Stripe did not accept a take-down refund', {
        paymentId: hold.paymentId,
        error: createError instanceof Error ? createError.message : String(createError),
      })
    } catch (findError) {
      log('could not check Stripe for an earlier refund', {
        paymentId: hold.paymentId,
        error: findError instanceof Error ? findError.message : String(findError),
      })
    }
    return null
  }
}
