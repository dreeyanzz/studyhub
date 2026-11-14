'use client'

// The hold panel, in STORY-11's slot for a selected Available unit (STORY-09 design §3
// and §8, TSK-09.6). Every prop is serializable, so the profile page renders it on the
// server for the `?unit=<id>` unit. "Hold this unit" posts to holdUnit, which works
// without JavaScript too. A refusal comes back as `?refused=`, and the page shows its
// message above the seat map.
import Link from 'next/link'
import { useFormStatus } from 'react-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import type { HoldTerms, ViewerRole } from '@/lib/data/reservations'
import { ONLY_SEEKERS } from '@/lib/payments/refusals'
import { formatManilaTime, formatPeso } from '@/lib/reservations/format'
import { cn } from '@/lib/utils'
import { formatWaitWindow } from '@/lib/validation/reservation'

import { holdUnit } from '../actions'

export interface HoldUnitPanelProps {
  spaceId: string
  unit: { id: string; label: string }
  /** Null when hold_terms gave no row. */
  terms: HoldTerms | null
  /** Null for a signed-out visitor. */
  viewerRole: ViewerRole | null
  /** The Seeker's hold elsewhere, if any (D-008). */
  currentHold: { id: string; unitLabel: string; spaceName: string } | null
  /** The seat map's view, so a refusal comes back to the same one (SRS §3.2.2). */
  view?: 'grid' | 'list'
}

const DISCOVERY_HREF = '/spaces'

/**
 * Lets a button's label wrap, so 200% text never cuts it off inside the profile's Card
 * on a 360 px screen (design §3, Accessibility). The hold page's WRAPPING_BUTTON and
 * the Host's photos page use the same classes; cn() lets them win over the button's
 * h-12, shrink-0 and whitespace-nowrap.
 */
const WRAPPING_BUTTON =
  'h-auto min-h-12 max-w-full shrink py-2 text-center whitespace-normal'

function linkClass(variant: 'default' | 'outline' = 'default'): string {
  return cn(buttonVariants({ variant }), WRAPPING_BUTTON)
}

/** Disabled while the hold is being made, so a second tap waits (W2 covers one anyway). */
function HoldButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className={WRAPPING_BUTTON}>
      Hold this unit
    </Button>
  )
}

function FeeLine({ terms }: { terms: HoldTerms }) {
  return (
    <p className="text-sm">
      Reservation fee: {formatPeso(terms.feeAmount)}. You&apos;ll have{' '}
      {terms.paymentWindowMinutes} minutes to pay.
    </p>
  )
}

export function HoldUnitPanel({
  spaceId,
  unit,
  terms,
  viewerRole,
  currentHold,
  view = 'grid',
}: HoldUnitPanelProps) {
  // Back to this profile with no unit chosen: the Seeker picks again (D-058).
  const returnUrl = encodeURIComponent(`/spaces/${spaceId}`)

  if (!terms) {
    return (
      <p className="text-sm text-muted-foreground">
        Holds aren&apos;t open for this Space right now.
      </p>
    )
  }

  if (viewerRole === null) {
    // seeker-signed-out-hold
    return (
      <div className="space-y-3">
        <FeeLine terms={terms} />
        <p className="text-sm">
          Holding a unit needs a Seeker account. You&apos;ll come back here to pick it
          again.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/login?returnUrl=${returnUrl}`} className={linkClass()}>
            Sign in
          </Link>
          <Link
            href={`/register?returnUrl=${returnUrl}&role=seeker`}
            className={linkClass('outline')}
          >
            Create a Seeker account
          </Link>
        </div>
      </div>
    )
  }

  if (viewerRole !== 'seeker') {
    // seeker-non-seeker-role-cannot-hold: no sign-in link.
    return <p className="text-sm">{ONLY_SEEKERS}</p>
  }

  if (currentHold) {
    // seeker-existing-hold-opens-dashboard
    return (
      <div className="space-y-3">
        <p className="text-sm">
          You&apos;re already holding {currentHold.unitLabel} at {currentHold.spaceName}.
          You can hold one unit at a time.
        </p>
        <Link href={`/seeker/reservations/${currentHold.id}`} className={linkClass()}>
          View your hold
        </Link>
      </div>
    )
  }

  if (terms.waitWindowMinutes.length === 0) {
    // seeker-no-wait-window-fits
    return (
      <div className="space-y-3">
        <p className="text-sm">
          No wait window fits before this Space closes
          {terms.nextClosingAt ? (
            <>
              {' at '}
              <time dateTime={terms.nextClosingAt}>
                {formatManilaTime(terms.nextClosingAt)}
              </time>
            </>
          ) : null}
          .
        </p>
        <Link href={DISCOVERY_HREF} className={linkClass('outline')}>
          Back to results
        </Link>
      </div>
    )
  }

  // seeker-wait-window-before-close, seeker-signed-in-hold
  const shortest = terms.waitWindowMinutes[0]
  return (
    <form action={holdUnit} className="space-y-4">
      <h3 className="text-base font-semibold">Hold {unit.label}</h3>
      <FeeLine terms={terms} />
      <input type="hidden" name="spaceId" value={spaceId} />
      <input type="hidden" name="unitId" value={unit.id} />
      <input type="hidden" name="unitLabel" value={unit.label} />
      {view === 'list' && <input type="hidden" name="view" value="list" />}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">
          How long should we keep it after you pay?
        </legend>
        <div className="flex flex-wrap gap-2">
          {terms.waitWindowMinutes.map((minutes) => (
            <label
              key={minutes}
              className="flex min-h-12 min-w-12 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="waitWindowMinutes"
                value={minutes}
                defaultChecked={minutes === shortest}
                className="size-5 accent-primary"
              />
              {formatWaitWindow(minutes)}
            </label>
          ))}
        </div>
      </fieldset>
      <HoldButton />
    </form>
  )
}
