import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { getMyReservation } from '@/lib/data/reservations'
import { formatPeso } from '@/lib/reservations/format'
import { createClient } from '@/lib/supabase/server'

import { PaymentCountdown } from './_components/payment-countdown'
import {
  CancelConfirmation,
  EndedView,
  HoldPlace,
  HoldStatusBadge,
  ManilaTime,
  PaymentActions,
  ReservedView,
} from './_components/reservation-status-view'

export const metadata: Metadata = { title: 'Your hold' }

type SearchParams = Record<string, string | string[] | undefined>

/**
 * The hold page (STORY-09 design §3, TSK-09.5, D-068): the Pending Payment screen
 * between the hold and Stripe's checkout (Seeker journey S28 to S31), and the
 * Reserved screen after it. It reads the hold through my_reservation, which records
 * lapses first (D-047), so a passed payment window shows how the hold ended.
 */
export default async function HoldPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const reservation = await getMyReservation(supabase, id)
  // Another Seeker's hold, or none: zero rows, the same as a missing page (N8).
  if (!reservation) notFound()

  const confirmingCancel = query.cancel === '1'
  const notices = (
    <>
      {query.notice === 'payment-won' && (
        <Alert>
          <AlertDescription>
            Your payment was confirmed just now, so your hold wasn&apos;t cancelled.
          </AlertDescription>
        </Alert>
      )}
      {query.error === 'cancel' && (
        <Alert variant="destructive">
          <AlertDescription>
            We could not cancel your hold. Check your connection and try again.
          </AlertDescription>
        </Alert>
      )}
    </>
  )

  switch (reservation.status) {
    case 'pending_payment':
      return (
        <div className="max-w-2xl space-y-6">
          {notices}
          {query.error === 'checkout' && (
            // W14 (seeker-payment-failure-retry).
            <Alert variant="destructive">
              <AlertDescription>
                We could not open the payment page. Try again, or cancel your hold.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <HoldStatusBadge status="pending_payment" />
            <h1 className="text-2xl font-bold tracking-tight">
              Hold {reservation.unitLabel}
            </h1>
            <HoldPlace reservation={reservation} />
          </div>
          <p className="text-lg">
            Pay {formatPeso(reservation.feeAmount)} by{' '}
            <ManilaTime iso={reservation.paymentWindowEndsAt} />{' '}
            <PaymentCountdown deadline={reservation.paymentWindowEndsAt} />
          </p>
          <p>
            We&apos;ll keep {reservation.unitLabel} for {reservation.waitWindowMinutes}{' '}
            min after you pay.
          </p>
          {confirmingCancel ? (
            <CancelConfirmation reservation={reservation} />
          ) : (
            <PaymentActions reservation={reservation} />
          )}
        </div>
      )

    case 'reserved':
      return (
        <div className="max-w-2xl space-y-6">
          {notices}
          <ReservedView reservation={reservation} confirmingCancel={confirmingCancel} />
        </div>
      )

    case 'expired':
    case 'cancelled':
      return (
        <div className="max-w-2xl space-y-6">
          {notices}
          <EndedView reservation={reservation} />
        </div>
      )

    default:
      // occupied, completed, no_show: STORY-10 shows these on /seeker.
      redirect('/seeker')
  }
}
