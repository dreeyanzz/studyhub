// The blocks the hold page and the return page share, one per status (STORY-09
// design §3, sandbox payment confirmation flow §5). Server Components: the forms post
// straight to the Server Actions, so cancelling and paying work without JavaScript.
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Clock, Hourglass, MapPin } from 'lucide-react'

import { BookingQrCode } from '@/components/reservation/qr-code'
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

/**
 * Lets a button's label wrap, so a long Space name or 200% text never runs off a
 * 360 px screen (design §3, Accessibility). cn() lets these win over the button's
 * h-12, shrink-0 and whitespace-nowrap, as on the Host's photos page.
 */
export const WRAPPING_BUTTON =
  'h-auto min-h-12 max-w-full shrink rounded-full px-5 py-2 text-center font-semibold whitespace-normal'

/** A link styled as a button, whose label wraps. */
export function buttonLinkClass(variant: 'default' | 'outline' = 'default'): string {
  return cn(buttonVariants({ variant }), WRAPPING_BUTTON)
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
        // Wraps like the buttons, so 200% text never pushes it off a 360 px screen.
        'h-auto min-h-7 max-w-full gap-1.5 rounded-full px-3 py-1 text-sm whitespace-normal',
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
 * sideways (design §3, Accessibility). A screen reader hears "Booking token" first:
 * a paragraph can't take an aria-label, so the label is hidden text.
 */
export function BookingToken({ token }: { token: string }) {
  const groups = formatToken(token).split('-')
  return (
    <p className="flex flex-wrap font-mono text-2xl font-semibold tracking-widest">
      <span className="sr-only">Booking token </span>
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
      <Button type="submit" className={WRAPPING_BUTTON}>
        Continue to payment
      </Button>
    </form>
  )
}

/**
 * "Continue to payment" and "Cancel hold", on the hold page and on the return page
 * after Stripe's cancel_url. "Cancel hold" opens the `?cancel=1` step.
 */
export function PaymentActions({ reservation }: { reservation: MyReservation }) {
  return (
    <div className="flex flex-wrap gap-3">
      <ContinueToPaymentForm reservation={reservation} />
      <Link
        href={`${holdPath(reservation)}?cancel=1`}
        className={buttonLinkClass('outline')}
      >
        Cancel hold
      </Link>
    </div>
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
      className="space-y-4 rounded-2xl border border-destructive/25 bg-muted/25 p-5 shadow-2xs"
    >
      <h2 id="cancel-heading" className="font-heading text-base font-semibold">
        {isPaid
          ? 'Cancel your reservation?'
          : `Cancel your hold on ${reservation.unitLabel}?`}
      </h2>
      <p className="text-sm text-muted-foreground">
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
          <Button type="submit" variant="destructive" className={WRAPPING_BUTTON}>
            {isPaid ? 'Cancel reservation' : 'Cancel hold'}
          </Button>
        </form>
        <Link href={holdPath(reservation)} className={buttonLinkClass('outline')}>
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
    <div
      className={cn(
        'grid grid-cols-1 items-start gap-6',
        reservation.bookingToken && 'md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]',
      )}
    >
      <section className="space-y-5 rounded-2xl border border-primary/25 bg-card p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <HoldStatusBadge status="reserved" />
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Reserved: {reservation.unitLabel}
          </h1>
          <HoldPlace reservation={reservation} />
        </div>
        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 px-4 py-3.5">
          {reservation.waitWindowEndsAt && (
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Check in by <ManilaTime iso={reservation.waitWindowEndsAt} />.
              </span>
            </p>
          )}
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{reservation.spaceAddress}</span>
          </p>
        </div>
        {confirmingCancel ? (
          <CancelConfirmation reservation={reservation} />
        ) : (
          <div className="border-t border-border/70 pt-4">
            <Link
              href={`${holdPath(reservation)}?cancel=1`}
              className={buttonLinkClass('outline')}
            >
              Cancel reservation
            </Link>
          </div>
        )}
      </section>

      {reservation.bookingToken && (
        <section className="flex flex-col items-center gap-3.5 rounded-2xl border border-border/80 bg-card p-5 text-center shadow-sm sm:p-6">
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">
            Check-in pass
          </p>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-2xs">
            <div className="rounded-xl bg-white p-2 shadow-2xs">
              <BookingQrCode token={reservation.bookingToken} />
            </div>
          </div>
          <BookingToken token={reservation.bookingToken} />
        </section>
      )}
    </div>
  )
}

type EndedHeading = {
  /** The hold page's own h1, or an h2 inside the /seeker card (STORY-10 design §3). */
  headingLevel?: 'h1' | 'h2'
  /** The id the card's section is labelled by. */
  headingId?: string
}

/**
 * What a Seeker reads once a hold has ended (flow §5, states 3 to 5). The hold page
 * shows the same message for an ended hold.
 */
export function EndedView({
  reservation,
  headingLevel = 'h1',
  headingId,
}: { reservation: MyReservation } & EndedHeading) {
  const heading = { headingLevel, headingId }
  const fee = formatPeso(reservation.feeAmount)
  const unit = reservation.unitLabel
  const backToSpace = (
    <Link href={`/spaces/${reservation.spaceId}`} className={buttonLinkClass()}>
      Back to {reservation.spaceName}
    </Link>
  )

  if (reservation.status === 'expired' && reservation.paymentStatus === 'paid') {
    // P2 (D-064): the payment came after the window. Recorded, never a unit.
    return (
      <EndedMessage title="Your payment window ran out" {...heading}>
        <p>
          Your payment window ran out before Stripe confirmed your payment, so {unit} was
          released. Your {fee} payment was recorded, and an Administrator can refund it.
        </p>
        <Link href="/spaces" className={buttonLinkClass()}>
          Find another Space
        </Link>
      </EndedMessage>
    )
  }

  if (reservation.status === 'expired') {
    return (
      <EndedMessage title="Your payment window ran out" {...heading}>
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
    <EndedMessage title={`Your hold on ${unit} has ended.`} {...heading}>
      <p>{feeLine}</p>
      {backToSpace}
    </EndedMessage>
  )
}

function EndedMessage({
  title,
  headingLevel = 'h1',
  headingId,
  children,
}: { title: string; children: ReactNode } & EndedHeading) {
  const Heading = headingLevel
  return (
    <div className="space-y-4">
      <Heading
        id={headingId}
        className={
          headingLevel === 'h1'
            ? 'font-heading text-2xl font-bold tracking-tight'
            : // The card's other ended states use this size (current-hold-card.tsx).
              'font-heading text-xl font-semibold'
        }
      >
        {title}
      </Heading>
      {children}
    </div>
  )
}
