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
        className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-full border border-border/80 bg-card px-4 text-sm font-medium text-foreground shadow-2xs transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
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
        <div className="mx-auto max-w-2xl space-y-6">
          {backLink}
          <ReservedView reservation={reservation} confirmingCancel={false} />
        </div>
      )

    case 'pending_payment':
      if (query.status === 'cancelled') {
        // 5. Back from Stripe's cancel_url, with the hold still open.
        return (
          <div className="mx-auto max-w-2xl space-y-6">
            {backLink}
            <section className="space-y-5 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
              <div className="space-y-2">
                <h1 className="font-heading text-2xl font-bold tracking-tight">
                  You left the payment page
                </h1>
                <HoldPlace reservation={reservation} />
              </div>
              <p className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-foreground">
                Your hold on {reservation.unitLabel} lasts until{' '}
                <ManilaTime iso={reservation.paymentWindowEndsAt} />.
              </p>
              <div className="border-t border-border/70 pt-4">
                <PaymentActions reservation={reservation} />
              </div>
            </section>
          </div>
        )
      }
      // 2. Waiting for the webhook (W9). Never "Continue to payment" here.
      return (
        <div className="mx-auto max-w-2xl space-y-6">
          {backLink}
          <section className="space-y-5 rounded-2xl border border-primary/25 bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3.5">
              <div
                aria-hidden="true"
                className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs"
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
        <div className="mx-auto max-w-2xl space-y-6">
          {backLink}
          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
            <EndedView reservation={reservation} />
          </section>
        </div>
      )

    default:
      redirect(`/seeker?reservation=${reservation.id}`)
  }
}
