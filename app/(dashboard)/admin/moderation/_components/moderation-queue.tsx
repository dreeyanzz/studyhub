'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Flag, History, Inbox } from 'lucide-react'

import { formatReviewScore } from '@/components/review/review-rating'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import type { AdminReviewQueueItem, ModerationEventItem } from '@/lib/data/admin'
import { formatDateTime } from '@/lib/space/format'
import { cn } from '@/lib/utils'
import {
  REVIEW_MODERATION_ACTION_LABELS,
  REVIEW_REPORT_OUTCOME_LABELS,
  type AdminShowCount,
  type ReviewModerationAction,
  type ReviewQueueList,
} from '@/lib/validation/admin'
import {
  REVIEW_RATING_CATEGORIES,
  REVIEW_REPORT_REASON_LABELS,
} from '@/lib/validation/review'
import { moderateReviewAction, type ModerateReviewResult } from '../actions'

const LIST_TABS: ReadonlyArray<{ value: ReviewQueueList; label: string }> = [
  { value: 'reported', label: 'Reported' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'removed', label: 'Removed' },
]

const EMPTY_HEADINGS: Record<ReviewQueueList, string> = {
  reported: 'No reported reviews',
  hidden: 'No hidden reviews',
  removed: 'No removed reviews',
}

const EMPTY_BODIES: Record<ReviewQueueList, string> = {
  reported: 'There are no visible reviews with open reports right now.',
  hidden: 'No reviews are currently hidden by an Administrator.',
  removed: 'No reviews have been permanently removed.',
}

const CONFIRMATION_COPY: Record<
  ReviewModerationAction,
  {
    title: string
    body: string
    confirmLabel: string
    pendingLabel: string
    destructive?: boolean
  }
> = {
  hide: {
    title: 'Hide review?',
    body: 'The review leaves public view and averages. You can restore it later.',
    confirmLabel: 'Hide',
    pendingLabel: 'Hiding...',
  },
  remove: {
    title: 'Remove review?',
    body: 'This cannot be undone. The review stays out of public view permanently and the Seeker cannot review that visit again.',
    confirmLabel: 'Remove permanently',
    pendingLabel: 'Removing...',
    destructive: true,
  },
  restore: {
    title: 'Restore review?',
    body: "The review returns to public view and counts in the Space's averages again.",
    confirmLabel: 'Restore',
    pendingLabel: 'Restoring...',
  },
  dismiss: {
    title: 'Dismiss reports?',
    body: 'Open reports close and the review stays visible.',
    confirmLabel: 'Dismiss reports',
    pendingLabel: 'Dismissing...',
  },
}

const MAX_ITEMS_SHOWN = 100
const PAGE_STEP = 25

export interface ModerationQueueProps {
  items: AdminReviewQueueItem[]
  historyByReviewId: Record<string, ModerationEventItem[]>
  list: ReviewQueueList
  shown: AdminShowCount
  hasMore: boolean
  /** Injectable for unit tests; defaults to `moderateReviewAction`. */
  onModerate?: (input: {
    reviewId: string
    action: ReviewModerationAction
    version: number
  }) => Promise<ModerateReviewResult>
}

interface PendingDialog {
  item: AdminReviewQueueItem
  action: ReviewModerationAction
}

/**
 * Interactive review moderation console (STORY-14 design §3 Screen 2, TSK-14.3,
 * FR-5.2, RV4–RV8, RP2, D-080, SRS §3.2.2, §3.5.2).
 */
export function ModerationQueue({
  items,
  historyByReviewId,
  list,
  shown,
  hasMore,
  onModerate = moderateReviewAction,
}: ModerationQueueProps) {
  const router = useRouter()
  const [pendingDialog, setPendingDialog] = useState<PendingDialog | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (!pendingDialog) return
    const { item, action } = pendingDialog
    setErrorBanner(null)
    setActiveReviewId(item.reviewId)

    startTransition(async () => {
      const result = await onModerate({
        reviewId: item.reviewId,
        action,
        version: item.version,
      })

      setPendingDialog(null)
      setActiveReviewId(null)

      if (result.success) {
        setAnnouncement(result.message)
        router.refresh()
        return
      }

      setErrorBanner(result.error)
      setAnnouncement(result.error)
    })
  }

  const nextShown = Math.min(shown + PAGE_STEP, MAX_ITEMS_SHOWN)
  const dialogCopy = pendingDialog ? CONFIRMATION_COPY[pendingDialog.action] : null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Review Moderation
        </h1>
        <p className="text-sm text-muted-foreground">
          Review reported content, restore hidden reviews, or remove them permanently.
        </p>
      </div>

      <nav aria-label="Review moderation lists" className="flex flex-wrap gap-2">
        {LIST_TABS.map((tab) => {
          const active = list === tab.value
          return (
            <Link
              key={tab.value}
              href={`/admin/moderation?list=${tab.value}`}
              aria-current={active ? 'page' : undefined}
              data-testid={`moderation-tab-${tab.value}`}
              className={cn(
                buttonVariants({ variant: active ? 'default' : 'outline' }),
                'h-auto min-h-12 min-w-12 py-2 whitespace-normal',
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
        data-testid="moderation-live-status"
        className={cn(
          announcement && !errorBanner
            ? 'rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm font-medium text-foreground'
            : 'sr-only',
        )}
      >
        {announcement ?? ''}
      </div>

      {errorBanner && (
        <Alert variant="destructive" role="alert" data-testid="moderation-action-error">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertTitle>Action could not be completed</AlertTitle>
          <AlertDescription>{errorBanner}</AlertDescription>
        </Alert>
      )}

      {items.length === 0 ? (
        <Card
          data-testid="moderation-empty-state"
          className="flex min-w-0 flex-col items-center justify-center p-6 text-center sm:p-8"
        >
          <Inbox className="mb-4 size-12 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold wrap-anywhere text-foreground">
            {EMPTY_HEADINGS[list]}
          </h2>
          <p className="mt-1 text-sm wrap-anywhere text-muted-foreground">
            {EMPTY_BODIES[list]}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const history = historyByReviewId[item.reviewId] ?? []
            const isCardBusy = isPending && activeReviewId === item.reviewId
            const openReportsLabel =
              item.openReportCount === 1
                ? '1 open report'
                : `${item.openReportCount} open reports`

            return (
              <Card
                key={item.reviewId}
                data-testid={`moderation-review-${item.reviewId}`}
                className="min-w-0"
              >
                <CardHeader className="min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-base font-semibold wrap-anywhere text-foreground">
                        {item.spaceStatus === 'verified' ? (
                          <Link
                            href={`/spaces/${item.spaceId}`}
                            className="inline-flex min-h-12 min-w-12 items-center text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                          >
                            {item.spaceName}
                          </Link>
                        ) : (
                          <span>{item.spaceName}</span>
                        )}
                      </h2>
                      <p className="text-sm wrap-anywhere text-muted-foreground">
                        Reviewer:{' '}
                        <span className="font-medium text-foreground">
                          {item.authorFullName}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {list === 'reported' && (
                        <span
                          data-testid={`open-report-count-${item.reviewId}`}
                          className="inline-flex h-auto min-h-6 max-w-full items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold whitespace-normal text-amber-950"
                        >
                          <Flag className="size-3 shrink-0" aria-hidden="true" />
                          <span>{openReportsLabel}</span>
                        </span>
                      )}
                      {item.status === 'hidden' && (
                        <span className="inline-flex h-auto min-h-6 max-w-full items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold whitespace-normal text-amber-950">
                          Hidden
                        </span>
                      )}
                      {item.status === 'removed' && (
                        <span className="inline-flex h-auto min-h-6 max-w-full items-center rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold whitespace-normal text-destructive">
                          Removed
                        </span>
                      )}
                      <span className="text-sm font-semibold text-foreground">
                        Overall {formatReviewScore(item.overall)} / 5
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Posted{' '}
                      <time dateTime={item.createdAt}>
                        {formatDateTime(item.createdAt)}
                      </time>
                    </span>
                    {item.editedAt && (
                      <span>
                        Edited{' '}
                        <time dateTime={item.editedAt}>
                          {formatDateTime(item.editedAt)}
                        </time>
                      </span>
                    )}
                    {(item.status === 'hidden' || item.status === 'removed') &&
                      item.statusChangedAt && (
                        <span>
                          {item.status === 'hidden' ? 'Hidden' : 'Removed'} by{' '}
                          {item.statusChangedByFullName ?? 'Administrator'} on{' '}
                          <time dateTime={item.statusChangedAt}>
                            {formatDateTime(item.statusChangedAt)}
                          </time>
                        </span>
                      )}
                  </div>
                </CardHeader>

                <CardContent className="min-w-0 space-y-4">
                  {/* Four ratings (FR-4.1, D-087) */}
                  <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2 text-xs">
                    {REVIEW_RATING_CATEGORIES.map((category) => (
                      <div
                        key={category.key}
                        className="min-w-0 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 break-words"
                      >
                        <dt className="text-muted-foreground">{category.label}</dt>
                        <dd className="font-semibold text-foreground">
                          {item[category.key]} / 5
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {/* Plain-text review comment (SRS §3.5.2) */}
                  {item.comment ? (
                    <p
                      data-testid={`review-comment-${item.reviewId}`}
                      className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm wrap-anywhere whitespace-pre-wrap text-foreground"
                    >
                      {item.comment}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No written comment.
                    </p>
                  )}

                  {/* Reports section */}
                  <section
                    aria-label="Reports"
                    className="min-w-0 space-y-2 border-t border-border pt-3"
                  >
                    <h3 className="text-sm font-semibold text-foreground">
                      Reports ({item.reports.length})
                    </h3>
                    {item.reports.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No reports on file.</p>
                    ) : (
                      <ul className="space-y-2">
                        {item.reports.map((report) => {
                          const editedAfterReport = report.reviewVersion < item.version
                          return (
                            <li
                              key={report.id}
                              data-testid={`moderation-report-${report.id}`}
                              className="min-w-0 space-y-1 rounded-lg border border-border/70 bg-background p-3 text-xs"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  {REVIEW_REPORT_REASON_LABELS[report.reason]}
                                </span>
                                <span className="wrap-anywhere text-muted-foreground">
                                  by {report.reporterFullName}
                                </span>
                                <time
                                  dateTime={report.createdAt}
                                  className="text-muted-foreground"
                                >
                                  {formatDateTime(report.createdAt)}
                                </time>
                                {editedAfterReport && (
                                  <span
                                    data-testid={`edited-after-report-${report.id}`}
                                    className="inline-flex h-auto min-h-5 max-w-full items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium whitespace-normal text-secondary-foreground"
                                  >
                                    edited after this report
                                  </span>
                                )}
                                {report.outcome && (
                                  <span className="inline-flex h-auto min-h-5 max-w-full items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium whitespace-normal text-foreground">
                                    Outcome:{' '}
                                    {REVIEW_REPORT_OUTCOME_LABELS[report.outcome]}
                                  </span>
                                )}
                              </div>
                              {report.note && (
                                <p className="wrap-anywhere whitespace-pre-wrap text-foreground">
                                  {report.note}
                                </p>
                              )}
                              {report.outcome && report.closedAt && (
                                <p className="text-muted-foreground">
                                  Closed by {report.closedByFullName ?? 'Administrator'}{' '}
                                  on{' '}
                                  <time dateTime={report.closedAt}>
                                    {formatDateTime(report.closedAt)}
                                  </time>
                                </p>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>

                  {/* Moderation history log, newest first (D-080) */}
                  <section
                    aria-label="Moderation history"
                    className="min-w-0 space-y-2 border-t border-border pt-3"
                  >
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <History className="size-4 shrink-0" aria-hidden="true" />
                      <span>Moderation history</span>
                    </h3>
                    {history.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No moderation actions recorded yet.
                      </p>
                    ) : (
                      <ol
                        data-testid={`moderation-history-${item.reviewId}`}
                        className="space-y-1.5 text-xs"
                      >
                        {history.map((event) => (
                          <li
                            key={event.id}
                            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">
                              {REVIEW_MODERATION_ACTION_LABELS[event.action]}
                            </span>
                            <span className="wrap-anywhere">
                              by {event.actorFullName ?? 'Administrator'}
                            </span>
                            <time dateTime={event.createdAt}>
                              {formatDateTime(event.createdAt)}
                            </time>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </CardContent>

                {list !== 'removed' && (
                  <CardFooter className="flex min-w-0 flex-wrap justify-end gap-2">
                    {list === 'reported' && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isPending}
                          aria-busy={isCardBusy}
                          data-testid={`moderation-dismiss-${item.reviewId}`}
                          onClick={() => setPendingDialog({ item, action: 'dismiss' })}
                          className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
                        >
                          Dismiss reports
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={isPending}
                          aria-busy={isCardBusy}
                          data-testid={`moderation-hide-${item.reviewId}`}
                          onClick={() => setPendingDialog({ item, action: 'hide' })}
                          className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
                        >
                          Hide
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={isPending}
                          aria-busy={isCardBusy}
                          data-testid={`moderation-remove-${item.reviewId}`}
                          onClick={() => setPendingDialog({ item, action: 'remove' })}
                          className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
                        >
                          Remove
                        </Button>
                      </>
                    )}

                    {list === 'hidden' && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isPending}
                          aria-busy={isCardBusy}
                          data-testid={`moderation-restore-${item.reviewId}`}
                          onClick={() => setPendingDialog({ item, action: 'restore' })}
                          className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
                        >
                          Restore
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={isPending}
                          aria-busy={isCardBusy}
                          data-testid={`moderation-remove-${item.reviewId}`}
                          onClick={() => setPendingDialog({ item, action: 'remove' })}
                          className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </CardFooter>
                )}
              </Card>
            )
          })}

          {hasMore && shown < MAX_ITEMS_SHOWN && (
            <div className="flex justify-center pt-2">
              <Link
                href={`/admin/moderation?list=${list}&show=${nextShown}`}
                data-testid="moderation-show-more"
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
              data-testid="moderation-cap-note"
              className="text-center text-sm text-muted-foreground"
            >
              Showing the first 100 reviews in this list.
            </p>
          )}
        </div>
      )}

      <AlertDialog
        open={pendingDialog !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setPendingDialog(null)
        }}
      >
        {dialogCopy && pendingDialog && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialogCopy.title}</AlertDialogTitle>
              <AlertDialogDescription>{dialogCopy.body}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant={dialogCopy.destructive ? 'destructive' : 'default'}
                disabled={isPending}
                aria-busy={isPending}
                data-testid="moderation-confirm-action"
                onClick={handleConfirm}
              >
                {isPending ? dialogCopy.pendingLabel : dialogCopy.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  )
}
