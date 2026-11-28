import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, History, Star } from 'lucide-react'

import type { ReservationHistoryItem, ReservationHistoryStatus } from '@/lib/data/history'
import { formatManilaDate, formatPeso } from '@/lib/reservations/format'
import { cn } from '@/lib/utils'

import { buttonLinkClass } from '../reservations/[id]/_components/reservation-status-view'

const STATUS_BADGE: Record<
  ReservationHistoryStatus,
  { label: string; className: string }
> = {
  completed: {
    label: 'Completed',
    className: 'border-primary/20 bg-accent text-accent-foreground',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-border bg-muted text-muted-foreground',
  },
  no_show: {
    label: 'No-show',
    className: 'border-amber-600/30 bg-amber-50 text-amber-950',
  },
  pending_payment: {
    label: 'Pending',
    className: 'border-border bg-secondary text-secondary-foreground',
  },
  reserved: {
    label: 'Reserved',
    className: 'border-primary/20 bg-secondary text-secondary-foreground',
  },
  occupied: {
    label: 'Checked in',
    className: 'border-amber-600/30 bg-amber-50 text-amber-950',
  },
  expired: {
    label: 'Expired',
    className: 'border-border bg-muted text-muted-foreground',
  },
}

interface ReservationHistoryCardProps {
  /** Optional top recent paid reservations shown inline on the dashboard. */
  recentItems?: ReservationHistoryItem[]
  /** Optional total count of returned past reservations. */
  totalCount?: number
  /** Whether more pages exist beyond totalCount. */
  hasMore?: boolean
}

/**
 * Reservation history card on the Seeker dashboard (STORY-16 design §3).
 * Links to /seeker/reservations with summary copy, and optionally surfaces recent
 * visits inline when the dashboard passes them.
 */
export function ReservationHistoryCard({
  recentItems,
  totalCount,
  hasMore = false,
}: ReservationHistoryCardProps = {}) {
  const hasCount = typeof totalCount === 'number'
  const countLabel = hasCount
    ? `${totalCount}${hasMore ? '+' : ''} ${totalCount === 1 && !hasMore ? 'visit' : 'visits'}`
    : null

  return (
    <section
      aria-labelledby="reservation-history-heading"
      className="space-y-5 rounded-3xl border border-border/80 bg-card p-6 shadow-card sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"
          >
            <History className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2
              id="reservation-history-heading"
              className="font-heading text-xl font-bold tracking-[-0.02em] text-foreground"
            >
              Reservation history
            </h2>
            <p className="text-sm text-muted-foreground">
              See past paid holds, hold the same unit again, or leave a review.
            </p>
          </div>
        </div>

        {countLabel && (
          <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-surface-subtle px-3 py-1 font-mono text-xs font-semibold text-foreground">
            {countLabel}
          </span>
        )}
      </div>

      {/* Inline recent visits preview when passed from /seeker */}
      {recentItems && recentItems.length > 0 && (
        <ul className="divide-y divide-border/70 rounded-2xl border border-border/80 bg-surface-subtle/55">
          {recentItems.map((item) => {
            const statusStyle = STATUS_BADGE[item.reservationStatus]
            const dateText = formatManilaDate(item.endedAt ?? item.createdAt)
            return (
              <li
                key={item.reservationId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-sm font-bold text-foreground">
                      {item.spaceName}
                    </p>
                    <span className="rounded-md bg-card px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground ring-1 ring-border">
                      Unit {item.unitLabel}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                        statusStyle.className,
                      )}
                    >
                      {statusStyle.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{dateText}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-medium text-foreground/80">
                      {formatPeso(item.feeAmount)}
                    </span>
                    {item.reviewId ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-medium text-primary">
                          <CheckCircle2 aria-hidden="true" className="size-3.5" />
                          Reviewed
                        </span>
                      </>
                    ) : item.reservationStatus === 'completed' ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-medium text-amber-800">
                          <Star aria-hidden="true" className="size-3.5" />
                          Ready to review
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                {item.spaceListed && (
                  <Link
                    href={`/spaces/${item.spaceId}`}
                    className="inline-flex min-h-12 min-w-12 shrink-0 items-center gap-1 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold whitespace-normal text-foreground transition-colors hover:border-primary/40 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <span>Book again</span>
                    <ArrowUpRight aria-hidden="true" className="size-3.5 text-primary" />
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Helpful 3-step onboarding strip for first-time Seekers with 0 past visits */}
      {recentItems && recentItems.length === 0 && (
        <ol className="grid grid-cols-1 gap-2.5 rounded-2xl border border-dashed border-border bg-surface-subtle/60 p-4 sm:grid-cols-3">
          <li className="space-y-1 rounded-xl bg-card/90 p-3 shadow-2xs">
            <span className="inline-flex size-6 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-bold text-primary">
              01
            </span>
            <p className="text-xs font-semibold text-foreground">Pick an open unit</p>
            <p className="text-xs text-muted-foreground">
              Browse verified Spaces and tap an available desk.
            </p>
          </li>
          <li className="space-y-1 rounded-xl bg-card/90 p-3 shadow-2xs">
            <span className="inline-flex size-6 items-center justify-center rounded-lg bg-accent font-mono text-xs font-bold text-accent-foreground">
              02
            </span>
            <p className="text-xs font-semibold text-foreground">Confirm your hold</p>
            <p className="text-xs text-muted-foreground">
              Complete the sandbox fee to lock your booking QR.
            </p>
          </li>
          <li className="space-y-1 rounded-xl bg-card/90 p-3 shadow-2xs">
            <span className="inline-flex size-6 items-center justify-center rounded-lg bg-brass-soft font-mono text-xs font-bold text-brass-foreground">
              03
            </span>
            <p className="text-xs font-semibold text-foreground">Check in &amp; review</p>
            <p className="text-xs text-muted-foreground">
              Scan at the desk and rate your study session later.
            </p>
          </li>
        </ol>
      )}

      {/* flex-wrap lets the icon sit above the label when even the wrapped label is
          too wide, so the link still fits a narrow card with 200% text (design §3). */}
      <Link
        href="/seeker/reservations"
        className={cn(buttonLinkClass('outline'), 'flex-wrap')}
      >
        <History aria-hidden="true" className="size-4 text-primary" /> View reservation
        history
      </Link>
    </section>
  )
}
