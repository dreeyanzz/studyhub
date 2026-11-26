// The "Your hold" card at the top of /seeker (STORY-09 design §3, STORY-10 design §3).
import Link from 'next/link'
import { Clock, MapPin, User } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MyReservation } from '@/lib/data/reservations'
import { formatPeso } from '@/lib/reservations/format'

import { checkOutAction } from '../actions'
import { PaymentCountdown } from '../reservations/[id]/_components/payment-countdown'
import {
  DirectionsLink,
  EndedView,
  HoldPlace,
  HoldStatusBadge,
  ManilaTime,
  ReservedQrCard,
  WRAPPING_BUTTON,
  buttonLinkClass,
} from '../reservations/[id]/_components/reservation-status-view'
import { WaitCountdown } from './wait-countdown'

export function CurrentHoldCard({
  hold,
  showEnded = false,
  confirmingCheckOut = false,
  checkOutError = false,
}: {
  hold: MyReservation | null
  showEnded?: boolean
  confirmingCheckOut?: boolean
  checkOutError?: boolean
}) {
  if (!hold) return null

  if (hold.status === 'pending_payment') {
    return (
      <section
        aria-labelledby="current-hold-heading"
        className="space-y-4 rounded-3xl border border-l-4 border-border/60 border-l-purple-600 bg-card p-6 shadow-[0_4px_20px_-8px_rgba(23,60,45,0.08)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="current-hold-heading" className="font-heading text-lg font-semibold">
            Your hold
          </h2>
          <HoldStatusBadge status={hold.status} />
        </div>
        <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-secondary/55 px-4 py-3">
          <span className="font-medium text-foreground">
            {hold.unitLabel} at {hold.spaceName}
          </span>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <span className="text-muted-foreground">
            Pay by <ManilaTime iso={hold.paymentWindowEndsAt} />{' '}
            <PaymentCountdown deadline={hold.paymentWindowEndsAt} />
          </span>
        </p>
        <Link href={`/seeker/reservations/${hold.id}`} className={buttonLinkClass()}>
          View your hold
        </Link>
      </section>
    )
  }

  if (hold.status === 'reserved') {
    return (
      <section
        aria-labelledby="current-hold-heading"
        className="space-y-4 rounded-3xl border border-l-4 border-border/60 border-l-primary bg-card p-6 shadow-[0_4px_20px_-8px_rgba(23,60,45,0.08)]"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <HoldStatusBadge status="reserved" />
            {hold.zoneName && (
              <Badge
                variant="secondary"
                className="h-auto min-h-7 max-w-full rounded-full px-3 py-1 text-sm whitespace-normal"
              >
                {hold.unitLabel} · {hold.zoneName}
              </Badge>
            )}
          </div>
          <h2 id="current-hold-heading" className="font-heading text-xl font-semibold">
            {hold.spaceName}
          </h2>
          <HoldPlace reservation={hold} />
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{hold.spaceAddress}</span>
          </p>
        </div>

        {hold.waitWindowEndsAt && (
          <div className="space-y-1 rounded-2xl bg-blue-50/75 px-4 py-3.5">
            <WaitCountdown deadline={hold.waitWindowEndsAt} reservationId={hold.id} />
            <p className="text-sm text-muted-foreground">
              Check in by <ManilaTime iso={hold.waitWindowEndsAt} />.
            </p>
          </div>
        )}

        {hold.bookingToken && <ReservedQrCard token={hold.bookingToken} />}

        <div className="flex flex-wrap gap-3 pt-1">
          <DirectionsLink spaceName={hold.spaceName} spaceAddress={hold.spaceAddress} />
          <Link href={`/spaces/${hold.spaceId}`} className={buttonLinkClass('outline')}>
            View Space details
          </Link>
          <Link
            href={`/seeker/reservations/${hold.id}?cancel=1`}
            className={buttonLinkClass('outline')}
          >
            Cancel reservation
          </Link>
        </div>
      </section>
    )
  }

  if (hold.status === 'occupied') {
    const unitWithZone = hold.zoneName
      ? `Checked In · Unit ${hold.unitLabel} (${hold.zoneName})`
      : `Checked In · Unit ${hold.unitLabel}`

    return (
      <section
        aria-labelledby="current-hold-heading"
        className="space-y-4 rounded-3xl border border-l-4 border-border/60 border-l-amber-600 bg-card p-6 shadow-[0_4px_20px_-8px_rgba(23,60,45,0.08)]"
      >
        {checkOutError && (
          <Alert variant="destructive" className="rounded-2xl border-destructive/30">
            <AlertDescription>
              We could not check you out. Check your connection and try again.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {/* The seat map's Occupied icon and colour (components/seat-map/seat-map-tile.tsx),
              as HoldStatusBadge does for Pending Payment and Reserved. */}
          <Badge
            variant="outline"
            className="h-auto min-h-7 max-w-full gap-1.5 rounded-full border-amber-600/40 bg-amber-50 px-3 py-1 text-sm whitespace-normal text-amber-950"
          >
            <User aria-hidden="true" className="text-amber-700" />
            {unitWithZone}
          </Badge>
          <h2 id="current-hold-heading" className="font-heading text-xl font-semibold">
            {hold.spaceName}
          </h2>
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{hold.spaceAddress}</span>
          </p>
          {hold.checkedInAt && (
            <p className="inline-flex items-center gap-2 rounded-full bg-secondary/65 px-3.5 py-2 text-sm text-foreground">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Arrived at <ManilaTime iso={hold.checkedInAt} />
              </span>
            </p>
          )}
        </div>

        {confirmingCheckOut ? (
          <div
            role="region"
            aria-labelledby="checkout-confirm-heading"
            className="space-y-3 rounded-2xl bg-muted/65 p-5"
          >
            <h3
              id="checkout-confirm-heading"
              className="font-heading text-base font-semibold"
            >
              Check out of {hold.unitLabel}?
            </h3>
            <p className="text-sm text-muted-foreground">
              Are you ready to leave? This will release unit {hold.unitLabel} for other
              Seekers.
            </p>
            <div className="flex flex-wrap gap-3">
              <form action={checkOutAction.bind(null, hold.id)}>
                <Button type="submit" className={WRAPPING_BUTTON}>
                  Check Out
                </Button>
              </form>
              <Link href="/seeker" className={buttonLinkClass('outline')}>
                Stay checked in
              </Link>
            </div>
          </div>
        ) : (
          <div className="pt-1">
            <Link href="/seeker?checkout=1" className={buttonLinkClass()}>
              Check Out
            </Link>
          </div>
        )}
      </section>
    )
  }

  if (!showEnded) return null

  if (hold.status === 'no_show') {
    return (
      <section
        aria-labelledby="current-hold-heading"
        className="space-y-3.5 rounded-3xl bg-card p-6"
      >
        <h2 id="current-hold-heading" className="font-heading text-xl font-semibold">
          Wait window lapsed · Unit released
        </h2>
        <HoldPlace reservation={hold} />
        <p className="text-sm">Your {formatPeso(hold.feeAmount)} fee was forfeited.</p>
        <Link href={`/spaces/${hold.spaceId}`} className={buttonLinkClass()}>
          Back to {hold.spaceName}
        </Link>
      </section>
    )
  }

  if (hold.status === 'completed') {
    return (
      <section
        aria-labelledby="current-hold-heading"
        className="space-y-3.5 rounded-3xl bg-card p-6"
      >
        <h2 id="current-hold-heading" className="font-heading text-xl font-semibold">
          Visit completed
        </h2>
        <HoldPlace reservation={hold} />
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/spaces/${hold.spaceId}#reviews-heading`}
            className={buttonLinkClass()}
          >
            Leave a review
          </Link>
          <Link href={`/spaces/${hold.spaceId}`} className={buttonLinkClass('outline')}>
            Back to {hold.spaceName}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="current-hold-heading"
      className="space-y-3.5 rounded-3xl bg-card p-6"
    >
      <EndedView reservation={hold} headingLevel="h2" headingId="current-hold-heading" />
    </section>
  )
}
