import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'

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

  const backLink = (
    <nav aria-label="Breadcrumb">
      <Link
        href="/seeker"
        className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>Back to dashboard</span>
      </Link>
    </nav>
  )

  switch (reservation.status) {
    case 'reserved':
      // 1. Confirmed.
      return (
        <div className="space-y-6">
          {backLink}
          <ReservedView reservation={reservation} confirmingCancel={false} />
        </div>
      )

    case 'pending_payment':
      if (query.status === 'cancelled') {
        // 5. Back from Stripe's cancel_url, with the hold still open.
        return (
          <div className="space-y-6">
            {backLink}
            <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <section className="space-y-5 rounded-3xl bg-card p-6">
                <div className="space-y-2">
                  <h1 className="font-heading text-2xl font-bold tracking-tight">
                    You left the payment page
                  </h1>
                  <HoldPlace reservation={reservation} />
                </div>
                <p className="rounded-2xl bg-muted/65 px-4 py-3 text-foreground">
                  Your hold on {reservation.unitLabel} lasts until{' '}
                  <ManilaTime iso={reservation.paymentWindowEndsAt} />.
                </p>
              </section>

              <section className="flex flex-col justify-between gap-4 rounded-3xl bg-secondary/75 p-6">
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  Next step
                </p>
                <PaymentActions reservation={reservation} />
              </section>
            </div>
          </div>
        )
      }
      // 2. Waiting for the webhook (W9). Never "Continue to payment" here.
      return (
        <div className="space-y-6">
          {backLink}
          <section className="max-w-3xl space-y-5 rounded-3xl bg-card p-6">
            <div className="flex items-start gap-3.5">
              <div
                aria-hidden="true"
                className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"
              >
                <Loader2 className="size-5 motion-safe:animate-spin" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <h1 className="font-heading text-2xl font-bold tracking-tight">
                  Confirming your payment with Stripe…
                </h1>
                <HoldPlace reservation={reservation} />
              </div>
            </div>
            <ConfirmationPoller />
          </section>
        </div>
      )

    case 'expired':
    case 'cancelled':
      // 3, 4 and 5: how it ended, and what happened to the fee.
      return (
        <div className="space-y-6">
          {backLink}
          <section className="max-w-3xl rounded-3xl bg-card p-6">
            <EndedView reservation={reservation} />
          </section>
        </div>
      )

    default:
      redirect(`/seeker?reservation=${reservation.id}`)
  }
}
