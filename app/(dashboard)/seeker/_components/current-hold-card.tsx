// The "Your hold" card at the top of /seeker (STORY-09 design §3, STORY-10 design §3).
import Link from 'next/link'
import { User } from 'lucide-react'

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
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <h2 id="current-hold-heading" className="text-lg font-semibold">
          Your hold
        </h2>
        <p className="flex flex-wrap items-center gap-2">
          <span>
            {hold.unitLabel} at {hold.spaceName}
          </span>
          <span aria-hidden="true">·</span>
          <HoldStatusBadge status={hold.status} />
          <span aria-hidden="true">·</span>
          <span>
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
        className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <HoldStatusBadge status="reserved" />
            {hold.zoneName && (
              <Badge
                variant="secondary"
                className="h-auto min-h-7 max-w-full px-2.5 py-1 text-sm whitespace-normal"
              >
                {hold.unitLabel} · {hold.zoneName}
              </Badge>
            )}
          </div>
          <h2 id="current-hold-heading" className="text-xl font-semibold">
            {hold.spaceName}
          </h2>
          <HoldPlace reservation={hold} />
          <p className="text-sm text-muted-foreground">{hold.spaceAddress}</p>
        </div>

        {hold.waitWindowEndsAt && (
          <div className="space-y-1">
            <WaitCountdown deadline={hold.waitWindowEndsAt} reservationId={hold.id} />
            <p className="text-sm text-muted-foreground">
              Check in by <ManilaTime iso={hold.waitWindowEndsAt} />.
            </p>
          </div>
        )}

        {hold.bookingToken && <ReservedQrCard token={hold.bookingToken} />}

        <div className="flex flex-wrap gap-3">
          <DirectionsLink spaceName={hold.spaceName} spaceAddress={hold.spaceAddress} />
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
        className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        {checkOutError && (
          <Alert variant="destructive">
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
            className="h-auto min-h-7 max-w-full gap-1.5 border-amber-600/40 bg-amber-50 px-2.5 py-1 text-sm whitespace-normal text-amber-950"
          >
            <User aria-hidden="true" className="text-amber-700" />
            {unitWithZone}
          </Badge>
          <h2 id="current-hold-heading" className="text-xl font-semibold">
            {hold.spaceName}
          </h2>
          <p className="text-sm text-muted-foreground">{hold.spaceAddress}</p>
          {hold.checkedInAt && (
            <p className="text-sm">
              Arrived at <ManilaTime iso={hold.checkedInAt} />
            </p>
          )}
        </div>

        {confirmingCheckOut ? (
          <div
            role="region"
            aria-labelledby="checkout-confirm-heading"
            className="space-y-3 rounded-lg border border-border bg-background/60 p-4"
          >
            <h3 id="checkout-confirm-heading" className="text-base font-semibold">
              Check out of {hold.unitLabel}?
            </h3>
            <p className="text-sm">
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
          <Link href="/seeker?checkout=1" className={buttonLinkClass()}>
            Check Out
          </Link>
        )}
      </section>
    )
  }

  if (!showEnded) return null

  if (hold.status === 'no_show') {
    return (
      <section
        aria-labelledby="current-hold-heading"
        className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <h2 id="current-hold-heading" className="text-xl font-semibold">
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
        className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <h2 id="current-hold-heading" className="text-xl font-semibold">
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
      className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <EndedView reservation={hold} headingLevel="h2" headingId="current-hold-heading" />
    </section>
  )
}
