'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Inbox } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import type { AdminPaymentRecordItem } from '@/lib/data/admin'
import { formatPeso } from '@/lib/reservations/format'
import { formatDateTime } from '@/lib/space/format'
import { cn } from '@/lib/utils'
import {
  PAYMENT_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  type AdminShowCount,
  type PaymentRecordFilter,
} from '@/lib/validation/admin'
import { RefundDialog } from './refund-dialog'

const FILTER_TABS: ReadonlyArray<{ value: PaymentRecordFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'forfeited', label: 'Forfeited' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'refundable', label: 'Refundable' },
]

const STATUS_BADGE_STYLES = {
  pending: 'border-border bg-muted text-foreground',
  paid: 'border-emerald-300 bg-emerald-100 text-emerald-950',
  forfeited: 'border-amber-300 bg-amber-100 text-amber-950',
  refunded: 'border-blue-300 bg-blue-100 text-blue-950',
} as const

const MAX_ITEMS_SHOWN = 100
const PAGE_STEP = 25

export interface PaymentsListProps {
  items: AdminPaymentRecordItem[]
  filter: PaymentRecordFilter
  shown: AdminShowCount
  hasMore: boolean
}

/**
 * Interactive sandbox payment records list and refund trigger
 * (STORY-14 design §3 Screen 3, TSK-14.4, FR-5.3, D-088, SRS §3.2.2).
 */
export function PaymentsList({ items, filter, shown, hasMore }: PaymentsListProps) {
  const router = useRouter()
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentRecordItem | null>(
    null,
  )
  const [announcement, setAnnouncement] = useState<string | null>(null)

  const nextShown = Math.min(shown + PAGE_STEP, MAX_ITEMS_SHOWN)

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 border-b border-border/80 pb-5">
        <p className="inline-block rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
          Administration · Ledger
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
          Payment Records
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Inspect paid, forfeited, and refunded sandbox fees, and refund a fee whose hold
          ended without a check-in.
        </p>
      </div>

      <nav aria-label="Payment filters" className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.value
          return (
            <Link
              key={tab.value}
              href={`/admin/payments?status=${tab.value}`}
              aria-current={active ? 'page' : undefined}
              data-testid={`payments-filter-${tab.value}`}
              className={cn(
                buttonVariants({ variant: active ? 'default' : 'outline' }),
                'h-auto min-h-12 min-w-12 rounded-full px-5 py-2 whitespace-normal',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Persistent polite status region for screen-reader announcements (design §3) */}
      <div
        role="status"
        aria-live="polite"
        data-testid="payments-live-status"
        className={cn(
          announcement
            ? 'rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm font-medium text-foreground'
            : 'sr-only',
        )}
      >
        {announcement ?? ''}
      </div>

      {items.length === 0 ? (
        <Card
          data-testid="payments-empty-state"
          className="flex min-w-0 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-surface-subtle/75 p-10 text-center shadow-card"
        >
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-card text-primary shadow-2xs">
            <Inbox className="size-7" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-xl font-semibold wrap-anywhere text-foreground">
            No payments match this filter.
          </h2>
          <p className="mt-1.5 max-w-md text-sm wrap-anywhere text-muted-foreground">
            Paid, forfeited, and refunded sandbox fees will appear here once Seekers
            complete checkout.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const paymentLabel = PAYMENT_STATUS_LABELS[item.paymentStatus]
            const reservationLabel = RESERVATION_STATUS_LABELS[item.reservationStatus]

            return (
              <Card
                key={item.paymentId}
                data-testid={`payment-record-${item.paymentId}`}
                className="min-w-0 rounded-3xl shadow-card"
              >
                <CardHeader className="min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-heading text-lg font-semibold wrap-anywhere text-foreground">
                        {item.spaceName} · {item.unitLabel}
                      </h2>
                      <p className="text-sm wrap-anywhere text-muted-foreground">
                        Seeker:{' '}
                        <span className="font-medium text-foreground">
                          {item.seekerFullName}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        data-testid={`payment-status-${item.paymentId}`}
                        className={cn(
                          'inline-flex h-auto min-h-6 max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-normal',
                          STATUS_BADGE_STYLES[item.paymentStatus],
                        )}
                      >
                        {paymentLabel}
                      </span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {formatPeso(item.feeAmount)}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="min-w-0 space-y-3 text-xs">
                  <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <dt className="text-muted-foreground">Reservation status</dt>
                      <dd className="font-medium text-foreground">{reservationLabel}</dd>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <dt className="text-muted-foreground">Paid</dt>
                      <dd className="font-medium text-foreground">
                        <time dateTime={item.paidAt}>{formatDateTime(item.paidAt)}</time>
                      </dd>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <dt className="text-muted-foreground">Stripe payment intent</dt>
                      <dd className="font-mono break-all text-foreground">
                        {item.paymentIntentId}
                      </dd>
                    </div>
                  </dl>

                  {item.paymentStatus === 'refunded' && (
                    <div
                      data-testid={`payment-refund-details-${item.paymentId}`}
                      className="min-w-0 space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-3"
                    >
                      <p className="font-semibold text-foreground">Refund details</p>
                      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-2">
                        {item.refundId && (
                          <div className="min-w-0 space-y-0.5">
                            <dt className="text-muted-foreground">Stripe refund ID</dt>
                            <dd className="font-mono break-all text-foreground">
                              {item.refundId}
                            </dd>
                          </div>
                        )}
                        {item.refundedAt && (
                          <div className="min-w-0 space-y-0.5">
                            <dt className="text-muted-foreground">Refunded</dt>
                            <dd className="font-medium text-foreground">
                              <time dateTime={item.refundedAt}>
                                {formatDateTime(item.refundedAt)}
                              </time>
                            </dd>
                          </div>
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <dt className="text-muted-foreground">Refunded by</dt>
                          <dd className="font-medium wrap-anywhere text-foreground">
                            {item.refundedByFullName ?? 'Administrator'}
                          </dd>
                        </div>
                      </dl>
                      {item.refundReason && (
                        <div className="min-w-0 space-y-0.5 pt-1">
                          <p className="text-muted-foreground">Reason</p>
                          <p className="wrap-anywhere whitespace-pre-wrap text-foreground">
                            {item.refundReason}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>

                {item.refundable && (
                  <CardFooter className="flex min-w-0 flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="default"
                      data-testid={`payment-refund-trigger-${item.paymentId}`}
                      onClick={() => setSelectedPayment(item)}
                      className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
                    >
                      Refund
                      <span className="sr-only">
                        {' '}
                        {item.spaceName} · {item.unitLabel}, paid by {item.seekerFullName}
                      </span>
                    </Button>
                  </CardFooter>
                )}
              </Card>
            )
          })}

          {hasMore && shown < MAX_ITEMS_SHOWN && (
            <div className="flex justify-center pt-2">
              <Link
                href={`/admin/payments?status=${filter}&show=${nextShown}`}
                data-testid="payments-show-more"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'h-auto min-h-12 min-w-12 py-2 whitespace-normal',
                )}
              >
                Show more
              </Link>
            </div>
          )}

          {hasMore && shown >= MAX_ITEMS_SHOWN && (
            <p
              data-testid="payments-cap-note"
              className="text-center text-sm text-muted-foreground"
            >
              Showing the first 100 payments for this filter.
            </p>
          )}
        </div>
      )}

      <RefundDialog
        payment={selectedPayment}
        open={selectedPayment !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPayment(null)
        }}
        onSuccess={(message) => {
          setAnnouncement(message)
          router.refresh()
        }}
        onReloadRequested={() => router.refresh()}
      />
    </div>
  )
}
