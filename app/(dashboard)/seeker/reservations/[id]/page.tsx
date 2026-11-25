import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Clock } from 'lucide-react'

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
  const backLink = (
    <nav aria-label="Breadcrumb">
      <Link
        href="/seeker"
        className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-full border border-border/80 bg-card px-4 text-sm font-medium text-foreground shadow-2xs transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>Back to dashboard</span>
      </Link>
    </nav>
  )

  const notices = (
    <>
      {query.notice === 'payment-won' && (
        <Alert className="rounded-2xl border-border/80 bg-card shadow-xs">
          <AlertDescription>
            Your payment was confirmed just now, so your hold wasn&apos;t cancelled.
          </AlertDescription>
        </Alert>
      )}
      {query.error === 'cancel' && (
        <Alert
          variant="destructive"
          className="rounded-2xl border-destructive/30 shadow-xs"
        >
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
        <div className="space-y-6">
          {backLink}
          {notices}
          {query.error === 'checkout' && (
            // W14 (seeker-payment-failure-retry).
            <Alert
              variant="destructive"
              className="rounded-2xl border-destructive/30 shadow-xs"
            >
              <AlertDescription>
                We could not open the payment page. Try again, or cancel your hold.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <section className="space-y-5 rounded-2xl border border-primary/25 bg-card p-5 shadow-sm sm:p-6">
              <div className="space-y-2">
                <HoldStatusBadge status="pending_payment" />
                <h1 className="font-heading text-2xl font-bold tracking-tight">
                  Hold {reservation.unitLabel}
                </h1>
                <HoldPlace reservation={reservation} />
              </div>
              <div className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5">
                <p className="text-lg font-medium text-foreground">
                  Pay {formatPeso(reservation.feeAmount)} by{' '}
                  <ManilaTime iso={reservation.paymentWindowEndsAt} />{' '}
                  <PaymentCountdown deadline={reservation.paymentWindowEndsAt} />
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    We&apos;ll keep {reservation.unitLabel} for{' '}
                    {reservation.waitWindowMinutes} min after you pay.
                  </span>
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
              <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                Next step
              </p>
              {confirmingCancel ? (
                <CancelConfirmation reservation={reservation} />
              ) : (
                <PaymentActions reservation={reservation} />
              )}
            </section>
          </div>
        </div>
      )

    case 'reserved':
      return (
        <div className="space-y-6">
          {backLink}
          {notices}
          <ReservedView reservation={reservation} confirmingCancel={confirmingCancel} />
        </div>
      )

    case 'expired':
    case 'cancelled':
      return (
        <div className="space-y-6">
          {backLink}
          {notices}
          <section className="max-w-3xl rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
            <EndedView reservation={reservation} />
          </section>
        </div>
      )

    default:
      // occupied, completed, no_show: STORY-10 shows these on /seeker.
      redirect(`/seeker?reservation=${reservation.id}`)
  }
}
