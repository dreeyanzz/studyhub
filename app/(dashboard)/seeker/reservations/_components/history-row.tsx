import Link from 'next/link'

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  HistoryPaymentStatus,
  HistoryReviewStatus,
  ReservationHistoryItem,
  ReservationHistoryStatus,
} from '@/lib/data/history'
import { formatManilaDate, formatPeso } from '@/lib/reservations/format'
import { formatDateTime } from '@/lib/space/format'

import { buttonLinkClass } from '../[id]/_components/reservation-status-view'

/**
 * Returns human-readable outcome wording for an ended reservation (STORY-16 design §3).
 * Words, never colour alone (Accessibility, D-031).
 */
export function getOutcomeLabel(status: ReservationHistoryStatus): string {
  switch (status) {
    case 'completed':
      return 'Visit completed'
    case 'no_show':
      return 'Missed check-in (no-show)'
    case 'cancelled':
      return 'Hold cancelled'
    case 'expired':
      return 'Payment arrived after hold ended'
    default:
      return status
  }
}

/**
 * Returns fee fate wording: paid, forfeited, or refunded with refunded_at date (STORY-16 design §3).
 */
export function getFeeFateLabel(
  paymentStatus: HistoryPaymentStatus,
  feeAmount: number,
  refundedAt: string | null,
): string {
  const formattedFee = formatPeso(feeAmount)
  switch (paymentStatus) {
    case 'paid':
      return `${formattedFee} paid`
    case 'forfeited':
      return `${formattedFee} forfeited`
    case 'refunded':
      return refundedAt
        ? `${formattedFee} refunded (${formatManilaDate(refundedAt)})`
        : `${formattedFee} refunded`
    default:
      return `${formattedFee} ${paymentStatus}`
  }
}

/**
 * Read-only review status for a checked-in visit (STORY-16 design §3, D-080).
 * Hidden and removed reviews name the Administrator, so the Seeker knows why.
 */
export function getReviewStatusLabel(status: HistoryReviewStatus): string {
  switch (status) {
    case 'visible':
      return 'Reviewed'
    case 'hidden':
      return 'Review hidden by an Administrator'
    case 'removed':
      return 'Review removed by an Administrator'
    default:
      return status
  }
}

export interface HistoryRowProps {
  item: ReservationHistoryItem
}

/**
 * Past reservation card (STORY-16 design §3).
 * Server Component displaying one past reservation with its Space name, unit label,
 * Manila timestamp, outcome/fee labels, Hold again link, and review status.
 * Leave a review and Edit your review arrive with ReviewDialog in TSK-16.4 (#385).
 */
export function HistoryRow({ item }: HistoryRowProps) {
  const outcomeText = getOutcomeLabel(item.reservationStatus)
  const feeFateText = getFeeFateLabel(item.paymentStatus, item.feeAmount, item.refundedAt)
  const unitLabelText =
    item.unitId === null ? `${item.unitLabel} (removed)` : item.unitLabel

  const holdAgainHref =
    item.unitId === null
      ? `/spaces/${item.spaceId}?from=history&unit_removed=1`
      : `/spaces/${item.spaceId}?unit=${item.unitId}&from=history`

  return (
    <Card data-testid="history-row" className="gap-3">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="min-w-0">
            <h2 className="text-lg font-semibold break-words">
              {item.spaceListed ? (
                <Link
                  href={`/spaces/${item.spaceId}`}
                  className="inline-flex min-h-12 min-w-12 items-center break-words hover:underline focus-visible:underline"
                >
                  {item.spaceName}
                </Link>
              ) : (
                <span>{item.spaceName}</span>
              )}
            </h2>
          </CardTitle>
          <time dateTime={item.createdAt} className="text-sm text-muted-foreground">
            {formatDateTime(item.createdAt)}
          </time>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{unitLabelText}</p>
      </CardHeader>

      <CardContent className="space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-medium text-foreground">{outcomeText}</span>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <span className="text-muted-foreground">{feeFateText}</span>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3 pt-3">
        <div className="max-w-full min-w-0">
          {!item.spaceListed ? (
            <p className="text-sm text-muted-foreground">
              This Space isn&apos;t listed right now
            </p>
          ) : (
            <Link href={holdAgainHref} className={buttonLinkClass('outline')}>
              Hold again
            </Link>
          )}
        </div>

        {item.checkedInAt !== null && item.reviewStatus !== null && (
          <p className="text-sm font-medium text-muted-foreground">
            {getReviewStatusLabel(item.reviewStatus)}
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
