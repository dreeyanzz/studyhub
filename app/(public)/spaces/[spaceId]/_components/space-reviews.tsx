import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

import {
  formatReviewDate,
  formatReviewScore,
  ReviewRating,
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
      className="space-y-6 rounded-xl border bg-card p-5 text-card-foreground shadow-xs sm:p-6"
    >
      <div className="space-y-1">
        <h2
          id="reviews-heading"
          className="font-heading text-xl font-bold tracking-tight text-foreground"
        >
          Reviews
        </h2>
      </div>

      {loadError ? (
        <Alert variant="destructive" role="alert" data-testid="reviews-load-error">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>
            We couldn&apos;t load reviews right now. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Averages Summary or Empty State */}
          {summary.reviewCount > 0 ? (
            <div className="space-y-4" data-testid="reviews-summary">
              <ReviewRating
                average={summary.avgOverall}
                count={summary.reviewCount}
                className="text-base font-semibold"
                data-testid="reviews-overall-rating"
              />
              <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-3">
                {categoryAverages.map((category) => (
                  <div
                    key={category.label}
                    className="min-w-0 rounded-lg border border-border bg-muted/30 px-3 py-2.5 break-words"
                  >
                    <dt className="text-xs text-muted-foreground">{category.label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-foreground">
                      {formatReviewScore(category.value)} / 5
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="space-y-1" data-testid="reviews-empty-state">
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

          {/* Sort links + Others' visible reviews */}
          {(summary.reviewCount > 0 || reviewsPage.reviews.length > 0) && (
            <div className="space-y-4 border-t border-border pt-5">
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
                        'inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border px-4 py-2 text-center text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                        isCurrent
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:bg-muted',
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
                <ul className="space-y-4" data-testid="space-reviews-list">
                  {reviewsPage.reviews.map((review) => {
                    const postedDate = formatReviewDate(review.createdAt)
                    return (
                      <li key={review.id}>
                        <article
                          data-testid={`review-card-${review.id}`}
                          className="space-y-3 rounded-lg border border-border bg-background p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">
                                  {review.reviewerName}
                                </p>
                                <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                                  Checked-in visit
                                </span>
                                {review.edited && (
                                  <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                                    Edited
                                  </span>
                                )}
                              </div>
                              {postedDate && (
                                <p className="text-xs text-muted-foreground">
                                  Reviewed{' '}
                                  <time dateTime={review.createdAt}>{postedDate}</time>
                                </p>
                              )}
                            </div>

                            <p className="text-sm font-semibold text-foreground">
                              Overall {formatReviewScore(review.overall)} / 5
                            </p>
                          </div>

                          <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-2 text-xs">
                            {REVIEW_RATING_CATEGORIES.map((category) => (
                              <div
                                key={category.key}
                                className="min-w-0 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 break-words"
                              >
                                <dt className="text-muted-foreground">
                                  {category.label}
                                </dt>
                                <dd className="font-semibold text-foreground">
                                  {review[category.key]} / 5
                                </dd>
                              </div>
                            ))}
                          </dl>

                          {/* Plain React text node only — never rendered as HTML (SRS §3.5.2). */}
                          {review.comment && (
                            <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                              {review.comment}
                            </p>
                          )}

                          {canReport && (
                            <div className="pt-1">
                              <ReportReviewDialog
                                spaceId={spaceId}
                                reviewId={review.id}
                                reportedByCaller={review.reportedByCaller}
                              />
                            </div>
                          )}
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
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
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
        </>
      )}
    </section>
  )
}
