// The "Your hold" card at the top of /seeker while the Seeker has a hold (STORY-09
// design §3). STORY-10's design decides the card it becomes once a hold is Reserved.
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import type { MyReservation } from '@/lib/data/reservations'

import {
  HoldStatusBadge,
  ManilaTime,
} from '../reservations/[id]/_components/reservation-status-view'

export function CurrentHoldCard({ hold }: { hold: MyReservation | null }) {
  // Only an unpaid or paid hold. Checked in (occupied) is STORY-10's.
  if (!hold || (hold.status !== 'pending_payment' && hold.status !== 'reserved'))
    return null

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
        {hold.status === 'pending_payment' ? (
          <span>
            Pay by <ManilaTime iso={hold.paymentWindowEndsAt} />
          </span>
        ) : (
          hold.waitWindowEndsAt && (
            <span>
              Check in by <ManilaTime iso={hold.waitWindowEndsAt} />
            </span>
          )
        )}
      </p>
      <Link href={`/seeker/reservations/${hold.id}`} className={buttonVariants()}>
        View your hold
      </Link>
    </section>
  )
}
