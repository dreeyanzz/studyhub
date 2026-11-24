import Link from 'next/link'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  HistoryPaymentStatus,
  ReservationHistoryItem,
  ReservationHistoryStatus,
} from '@/lib/data/history'
import { formatManilaDate, formatPeso } from '@/lib/reservations/format'
import { formatDateTime } from '@/lib/space/format'
import { cn } from '@/lib/utils'

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

export interface HistoryRowProps {
  item: ReservationHistoryItem
}

/**
 * Past reservation card (STORY-16 design §3).
 * Server Component displaying one past reservation with its Space name, unit label,
 * Manila timestamp, outcome/fee labels, Hold again link, and review action state.
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
          <CardTitle className="text-lg">
            {item.spaceListed ? (
              <Link
                href={`/spaces/${item.spaceId}`}
                className="hover:underline focus-visible:underline"
              >
                {item.spaceName}
              </Link>
            ) : (
              <span>{item.spaceName}</span>
            )}
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
        <div>
          {!item.spaceListed ? (
            <p className="text-sm text-muted-foreground">
              This Space isn&apos;t listed right now
            </p>
          ) : (
            <Link
              href={holdAgainHref}
              className={cn(buttonVariants({ variant: 'outline' }), 'min-h-12 min-w-12')}
            >
              Hold again
            </Link>
          )}
        </div>

        {item.checkedInAt !== null && (
          <div className="flex flex-wrap items-center gap-2">
            {!item.reviewId || !item.reviewStatus ? (
              <Button variant="outline" className="min-h-12 min-w-12">
                Leave a review
              </Button>
            ) : item.reviewStatus === 'visible' ? (
              <>
                <span className="text-sm font-medium text-muted-foreground">
                  Reviewed
                </span>
                <Button variant="outline" className="min-h-12 min-w-12">
                  Edit your review
                </Button>
              </>
            ) : item.reviewStatus === 'hidden' ? (
              <p className="text-sm text-muted-foreground">
                Review hidden by an Administrator
              </p>
            ) : item.reviewStatus === 'removed' ? (
              <p className="text-sm text-muted-foreground">
                Review removed by an Administrator
              </p>
            ) : null}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
