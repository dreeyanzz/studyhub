import Link from 'next/link'
import { AlertCircle, Star } from 'lucide-react'

import {
  formatReviewDate,
  formatReviewScore,
  ReviewRating,
  SolidStars,
} from '@/components/review/review-rating'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type {
  AuthorReview,
  ReviewableVisit,
  SpaceReviewsPage,
  SpaceReviewSummary,
} from '@/lib/data/reviews'
import { cn } from '@/lib/utils'
import {
  REVIEW_RATING_CATEGORIES,
  type ReviewShowCount,
  type ReviewSort,
} from '@/lib/validation/review'
import { AuthorReviewsSection } from './author-review-card'
import { ReportReviewDialog } from './report-review-dialog'

const MAX_REVIEWS_SHOWN = 50
const REVIEWS_PAGE_STEP = 10

const SORT_OPTIONS: ReadonlyArray<{ value: ReviewSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
]

export function buildReviewsHref(
  spaceId: string,
  params: {
    sort: ReviewSort
    reviews: number
    view?: string
    unit?: string
  },
): string {
  const search = new URLSearchParams()
  if (params.view) search.set('view', params.view)
  if (params.unit) search.set('unit', params.unit)
  search.set('sort', params.sort)
  search.set('reviews', String(params.reviews))
  return `/spaces/${spaceId}?${search.toString()}`
}

export interface SpaceReviewsProps {
  spaceId: string
  summary: SpaceReviewSummary | null
  reviewsPage: SpaceReviewsPage | null
  myReviews: AuthorReview[] | null
  reviewableVisit: ReviewableVisit | null
  viewerShortName: string
  /** True when the viewer is signed in with a confirmed role and may report others' reviews (RP1, D-095). */
  canReport?: boolean
  sort: ReviewSort
  shown: ReviewShowCount
  view?: string
  unit?: string
}

/**
 * Community reviews section rendered below SpaceSeatMapView on `/spaces/[spaceId]`
 * (STORY-13 design §3 Screen 1, TSK-13.4, FR-4.1, D-076, D-080, D-081, D-087, SRS §3.5.2).
 */
export function SpaceReviews({
  spaceId,
  summary,
  reviewsPage,
  myReviews,
  reviewableVisit,
  viewerShortName,
  canReport = false,
  sort,
  shown,
  view,
  unit,
}: SpaceReviewsProps) {
  const loadError = summary === null || reviewsPage === null || myReviews === null

  const categoryAverages = summary
    ? [
        { label: 'Quietness', value: summary.avgQuietness },
        { label: 'Wi-Fi reliability', value: summary.avgWifiReliability },
        { label: 'Cleanliness', value: summary.avgCleanliness },
        { label: 'Comfort', value: summary.avgComfort },
      ]
    : []

  const nextShown = Math.min(shown + REVIEWS_PAGE_STEP, MAX_REVIEWS_SHOWN)

  return (
    <section
      aria-labelledby="reviews-heading"
      data-testid="space-reviews-section"
      className="space-y-6 rounded-3xl border border-primary/15 bg-secondary/50 p-6 text-card-foreground sm:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">
            Community Feedback
          </p>
          <h2
            id="reviews-heading"
            className="font-heading text-xl font-bold tracking-tight text-foreground"
          >
            Reviews
          </h2>
        </div>

        {!loadError && summary.reviewCount > 0 && (
          <ReviewRating
            average={summary.avgOverall}
            count={summary.reviewCount}
            className="rounded-full bg-card px-4 py-1.5 text-base font-semibold"
            data-testid="reviews-overall-rating"
          />
        )}
      </div>

      {loadError ? (
        <Alert
          variant="destructive"
          role="alert"
          data-testid="reviews-load-error"
          className="rounded-2xl border-destructive/30 bg-card"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>
            We couldn&apos;t load reviews right now. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* Averages scorecard strip (solid white divided bar with solid stars + numeric scores) or Empty State */}
          {summary.reviewCount > 0 ? (
            <div data-testid="reviews-summary">
              <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] divide-y divide-border/60 rounded-2xl border border-border/50 bg-card shadow-[0_2px_10px_-4px_rgba(23,60,45,0.06)] sm:divide-x sm:divide-y-0">
                {categoryAverages.map((category) => (
                  <div
                    key={category.label}
                    className="min-w-0 space-y-1.5 px-5 py-4 break-words"
                  >
                    <dt className="text-xs font-medium text-muted-foreground">
                      {category.label}
                    </dt>
                    <dd className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      <SolidStars value={category.value} size="sm" />
                      <span>{formatReviewScore(category.value)} / 5</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div
              className="space-y-1 rounded-2xl bg-card p-6"
              data-testid="reviews-empty-state"
            >
              <p className="text-base font-medium text-foreground">No reviews yet</p>
              <p className="text-sm text-muted-foreground">
                Be the first to review after checking in.
              </p>
            </div>
          )}

          {/* Write a review + Seeker's own reviews (pinned above others' reviews) */}
          <AuthorReviewsSection
            spaceId={spaceId}
            viewerShortName={viewerShortName}
            reviewableVisit={reviewableVisit}
            myReviews={myReviews}
          />

          {/* Sort links + Others' visible reviews in side-by-side solid cards */}
          {(summary.reviewCount > 0 || reviewsPage.reviews.length > 0) && (
            <div className="space-y-4">
              <nav
                aria-label="Sort reviews"
                className="flex flex-wrap items-center gap-2"
              >
                {SORT_OPTIONS.map((option) => {
                  const isCurrent = sort === option.value
                  return (
                    <Link
                      key={option.value}
                      href={buildReviewsHref(spaceId, {
                        sort: option.value,
                        reviews: shown,
                        view,
                        unit,
                      })}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={cn(
                        'inline-flex min-h-12 min-w-12 items-center justify-center rounded-full px-4 py-2 text-center text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                        isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-foreground hover:bg-accent',
                      )}
                    >
                      {option.label}
                    </Link>
                  )
                })}
              </nav>

              {reviewsPage.reviews.length === 0 ? (
                <p
                  data-testid="no-other-reviews"
                  className="text-sm text-muted-foreground"
                >
                  No other reviews yet.
                </p>
              ) : (
                <ul
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                  data-testid="space-reviews-list"
                >
                  {reviewsPage.reviews.map((review) => {
                    const postedDate = formatReviewDate(review.createdAt)
                    const initial =
                      review.reviewerName.trim().charAt(0).toUpperCase() || 'S'
                    return (
                      <li key={review.id} className="min-w-0">
                        <article
                          data-testid={`review-card-${review.id}`}
                          className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-[0_2px_12px_-6px_rgba(23,60,45,0.08)] sm:p-6"
                        >
                          <div className="space-y-3.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex min-w-0 items-start gap-3">
                                <span
                                  aria-hidden="true"
                                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-sm font-bold text-primary"
                                >
                                  {initial}
                                </span>
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-foreground">
                                      {review.reviewerName}
                                    </p>
                                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                                      Checked-in visit
                                    </span>
                                    {review.edited && (
                                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                                        Edited
                                      </span>
                                    )}
                                  </div>
                                  {postedDate && (
                                    <p className="text-xs text-muted-foreground">
                                      Reviewed{' '}
                                      <time dateTime={review.createdAt}>
                                        {postedDate}
                                      </time>
                                    </p>
                                  )}
                                </div>
                              </div>

                              <p className="inline-flex items-center gap-1.5 rounded-full bg-secondary/75 px-3 py-1 text-sm font-semibold text-foreground">
                                <Star
                                  className="size-3.5 shrink-0 fill-[#eab308] text-[#ca8a04]"
                                  aria-hidden="true"
                                />
                                <span>
                                  Overall {formatReviewScore(review.overall)} / 5
                                </span>
                              </p>
                            </div>

                            {/* Plain React text node only — never rendered as HTML (SRS §3.5.2). */}
                            {review.comment && (
                              <p className="rounded-xl border-l-2 border-l-primary/40 bg-background/85 px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                                {review.comment}
                              </p>
                            )}
                          </div>

                          <div className="space-y-3">
                            <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-2 text-xs">
                              {REVIEW_RATING_CATEGORIES.map((category) => (
                                <div
                                  key={category.key}
                                  className="min-w-0 space-y-1 rounded-xl bg-muted/65 px-3 py-2 break-words"
                                >
                                  <dt className="text-muted-foreground">
                                    {category.label}
                                  </dt>
                                  <dd className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                                    <SolidStars value={review[category.key]} size="xs" />
                                    <span>{review[category.key]} / 5</span>
                                  </dd>
                                </div>
                              ))}
                            </dl>

                            {canReport && (
                              <div>
                                <ReportReviewDialog
                                  spaceId={spaceId}
                                  reviewId={review.id}
                                  reportedByCaller={review.reportedByCaller}
                                />
                              </div>
                            )}
                          </div>
                        </article>
                      </li>
                    )
                  })}
                </ul>
              )}

              {reviewsPage.hasMore && shown < MAX_REVIEWS_SHOWN && (
                <div>
                  <Link
                    href={buildReviewsHref(spaceId, {
                      sort,
                      reviews: nextShown,
                      view,
                      unit,
                    })}
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-card px-5 py-2 text-center text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Show more reviews
                  </Link>
                </div>
              )}

              {reviewsPage.hasMore && shown >= MAX_REVIEWS_SHOWN && (
                <p
                  data-testid="reviews-cap-notice"
                  className="text-sm text-muted-foreground"
                >
                  Showing the first 50 reviews in this order.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
