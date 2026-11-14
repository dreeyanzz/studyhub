import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { getMyReservation } from '@/lib/data/reservations'
import { createClient } from '@/lib/supabase/server'

import { ConfirmationPoller } from '../_components/confirmation-poller'
import {
  EndedView,
  HoldPlace,
  ManilaTime,
  PaymentActions,
  ReservedView,
} from '../_components/reservation-status-view'

export const metadata: Metadata = { title: 'Your payment' }

/**
 * The return page, Stripe's success_url and cancel_url (`?status=cancelled`), with
 * the five states of the sandbox payment confirmation flow's §5 (STORY-09 design §3).
 * A browser return is not proof of payment: only the webhook makes a hold Reserved
 * (D-010), so `?status=cancelled` only chooses the wording, never a status.
 */
export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const reservation = await getMyReservation(supabase, id)
  if (!reservation) notFound()

  switch (reservation.status) {
    case 'reserved':
      // 1. Confirmed.
      return (
        <div className="max-w-2xl space-y-6">
          <ReservedView reservation={reservation} confirmingCancel={false} />
        </div>
      )

    case 'pending_payment':
      if (query.status === 'cancelled') {
        // 5. Back from Stripe's cancel_url, with the hold still open.
        return (
          <div className="max-w-2xl space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                You left the payment page
              </h1>
              <HoldPlace reservation={reservation} />
            </div>
            <p>
              Your hold on {reservation.unitLabel} lasts until{' '}
              <ManilaTime iso={reservation.paymentWindowEndsAt} />.
            </p>
            <PaymentActions reservation={reservation} />
          </div>
        )
      }
      // 2. Waiting for the webhook (W9). Never "Continue to payment" here.
      return (
        <div className="max-w-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Confirming your payment with Stripe…
            </h1>
            <HoldPlace reservation={reservation} />
          </div>
          <ConfirmationPoller />
        </div>
      )

    case 'expired':
    case 'cancelled':
      // 3, 4 and 5: how it ended, and what happened to the fee.
      return (
        <div className="max-w-2xl space-y-6">
          <EndedView reservation={reservation} />
        </div>
      )

    default:
      redirect('/seeker')
  }
}
