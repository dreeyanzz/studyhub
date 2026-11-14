// The blocks the hold page and the return page share, one per status (STORY-09
// design §3, sandbox payment confirmation flow §5). Server Components: the forms post
// straight to the Server Actions, so cancelling and paying work without JavaScript.
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Clock, Hourglass } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatToken } from '@/lib/check-in/normalize'
import type { MyReservation } from '@/lib/data/reservations'
import { formatManilaTime, formatPeso } from '@/lib/reservations/format'
import { cn } from '@/lib/utils'

import { cancelHold, startCheckout } from '../actions'

export function holdPath(reservation: Pick<MyReservation, 'id'>): string {
  return `/seeker/reservations/${reservation.id}`
}

/** A time in Asia/Manila, in a <time> element (design §3, D-048). */
export function ManilaTime({ iso }: { iso: string }) {
  return <time dateTime={iso}>{formatManilaTime(iso)}</time>
}

/** "S4 · Quiet desks · Kapihan Study Hall". */
export function HoldPlace({ reservation }: { reservation: MyReservation }) {
  return (
    <p className="text-sm text-muted-foreground">
      {[reservation.unitLabel, reservation.zoneName, reservation.spaceName]
        .filter(Boolean)
        .join(' · ')}
    </p>
  )
}

/**
 * The seat map tile's icon and colour for the same state
 * (components/seat-map/seat-map-tile.tsx), and its name in words, so the status is
 * never told by colour alone (design §3, Accessibility).
 */
export function HoldStatusBadge({ status }: { status: 'pending_payment' | 'reserved' }) {
  const Icon = status === 'pending_payment' ? Hourglass : Clock
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-7 gap-1.5 px-2.5 text-sm',
        status === 'pending_payment'
          ? 'border-purple-600/40 bg-purple-50 text-purple-950'
          : 'border-blue-600/40 bg-blue-50 text-blue-950',
      )}
    >
      <Icon
        aria-hidden="true"
        className={status === 'pending_payment' ? 'text-purple-700' : 'text-blue-700'}
      />
      {status === 'pending_payment' ? 'Pending Payment' : 'Reserved'}
    </Badge>
  )
}

/**
 * The booking token as ABCD-EFGH-JKMN (STORY-10's formatToken, D-059). Each group is
 * its own box, so a narrow screen or 200% text wraps it between groups, never
 * sideways (design §3, Accessibility).
 */
export function BookingToken({ token }: { token: string }) {
  const groups = formatToken(token).split('-')
  return (
    <p
      className="flex flex-wrap font-mono text-2xl font-semibold tracking-widest"
      aria-label={`Booking token ${groups.join(' ')}`}
    >
      {groups.map((group, index) => (
        <span key={index} className="whitespace-nowrap">
          {group}
          {index < groups.length - 1 ? '-' : ''}
        </span>
      ))}
    </p>
  )
}

/** "Continue to payment", posting to startCheckout (seeker-continues-to-checkout). */
export function ContinueToPaymentForm({ reservation }: { reservation: MyReservation }) {
  return (
    <form action={startCheckout.bind(null, reservation.id)}>
      <Button type="submit">Continue to payment</Button>
    </form>
  )
}

/**
 * The confirmation step at `?cancel=1`, which works by keyboard and without
 * JavaScript (design §3, seeker-cancel-pending-hold).
 */
export function CancelConfirmation({ reservation }: { reservation: MyReservation }) {
  const isPaid = reservation.status === 'reserved'
  const fee = formatPeso(reservation.feeAmount)
  return (
    <section
      aria-labelledby="cancel-heading"
      className="space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <h2 id="cancel-heading" className="text-base font-semibold">
        {isPaid
          ? 'Cancel your reservation?'
          : `Cancel your hold on ${reservation.unitLabel}?`}
      </h2>
      <p className="text-sm">
        {isPaid
          ? `Your ${fee} fee will be forfeited, and ${reservation.unitLabel} will be released at once.`
          : 'Nothing has been charged.'}
      </p>
      <div className="flex flex-wrap gap-3">
        <form
          action={cancelHold.bind(
            null,
            reservation.id,
            isPaid ? 'reserved' : 'pending_payment',
          )}
        >
          <Button type="submit" variant="destructive">
            {isPaid ? 'Cancel reservation' : 'Cancel hold'}
          </Button>
        </form>
        <Link
          href={holdPath(reservation)}
          className={buttonVariants({ variant: 'outline' })}
        >
          {isPaid ? 'Keep my reservation' : 'Keep my hold'}
        </Link>
      </div>
    </section>
  )
}

/** Reserved: the token and the check-in time (seeker-hold-and-pay). */
export function ReservedView({
  reservation,
  confirmingCancel,
}: {
  reservation: MyReservation
  confirmingCancel: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <HoldStatusBadge status="reserved" />
        <h1 className="text-2xl font-bold tracking-tight">
          Reserved: {reservation.unitLabel}
        </h1>
        <HoldPlace reservation={reservation} />
      </div>
      {reservation.bookingToken && <BookingToken token={reservation.bookingToken} />}
      {reservation.waitWindowEndsAt && (
        <p>
          Check in by <ManilaTime iso={reservation.waitWindowEndsAt} />.
        </p>
      )}
      <p className="text-sm text-muted-foreground">{reservation.spaceAddress}</p>
      {confirmingCancel ? (
        <CancelConfirmation reservation={reservation} />
      ) : (
        <Link
          href={`${holdPath(reservation)}?cancel=1`}
          className={buttonVariants({ variant: 'outline' })}
        >
          Cancel reservation
        </Link>
      )}
    </div>
  )
}

/**
 * What a Seeker reads once a hold has ended (flow §5, states 3 to 5). The hold page
 * shows the same message for an ended hold.
 */
export function EndedView({ reservation }: { reservation: MyReservation }) {
  const fee = formatPeso(reservation.feeAmount)
  const unit = reservation.unitLabel
  const backToSpace = (
    <Link href={`/spaces/${reservation.spaceId}`} className={buttonVariants()}>
      Back to {reservation.spaceName}
    </Link>
  )

  if (reservation.status === 'expired' && reservation.paymentStatus === 'paid') {
    // P2 (D-064): the payment came after the window. Recorded, never a unit.
    return (
      <EndedMessage title="Your payment window ran out">
        <p>
          Your payment window ran out before Stripe confirmed your payment, so {unit} was
          released. Your {fee} payment was recorded, and an Administrator can refund it.
        </p>
        <Link href="/spaces" className={buttonVariants()}>
          Find another Space
        </Link>
      </EndedMessage>
    )
  }

  if (reservation.status === 'expired') {
    return (
      <EndedMessage title="Your payment window ran out">
        <p>Your payment window ran out, and nothing was charged. {unit} is open again.</p>
        {backToSpace}
      </EndedMessage>
    )
  }

  // cancelled
  const feeLine =
    reservation.paymentStatus === 'forfeited'
      ? `Your ${fee} fee was forfeited.`
      : reservation.paymentStatus === 'paid'
        ? `Your ${fee} payment was recorded, and an Administrator can refund it.`
        : reservation.paymentStatus === 'refunded'
          ? `Your ${fee} payment was refunded.`
          : 'Nothing was charged.'
  return (
    <EndedMessage title={`Your hold on ${unit} has ended.`}>
      <p>{feeLine}</p>
      {backToSpace}
    </EndedMessage>
  )
}

function EndedMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  )
}
