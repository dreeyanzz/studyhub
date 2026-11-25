'use client'

import { useState, useTransition } from 'react'
import { AlertCircle } from 'lucide-react'

import { ReviewForm } from '@/components/review/review-form'
import { formatReviewDate, formatReviewScore } from '@/components/review/review-rating'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Button } from '@/components/ui/button'
import type { AuthorReview, ReviewableVisit } from '@/lib/data/reviews'
import { cn } from '@/lib/utils'
import { REVIEW_RATING_CATEGORIES } from '@/lib/validation/review'
import { deleteReviewAction, editReviewAction, postReviewAction } from '../actions'

const MODERATION_STATUS_LABEL: Partial<Record<AuthorReview['status'], string>> = {
  hidden: 'Hidden by an Administrator',
  removed: 'Removed by an Administrator',
}

export interface AuthorReviewCardProps {
  review: AuthorReview
  reviewerShortName: string
  onFeedback: (message: string) => void
}

/**
 * Signed-in Seeker's own review card on `/spaces/[spaceId]`
 * (STORY-13 design §3 Screen 1, TSK-13.4, RV2, RV3, D-080, SRS §3.5.2).
 *
 * Displays the review in any status. While visible, offers inline Edit (`ReviewForm`)
 * and Delete (`AlertDialog` confirmation). Hidden and removed reviews are read-only
 * and show the Administrator moderation label.
 */
export function AuthorReviewCard({
  review,
  reviewerShortName,
  onFeedback,
}: AuthorReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  const canModify = review.status === 'visible'
  const statusLabel = MODERATION_STATUS_LABEL[review.status]
  const postedDate = formatReviewDate(review.createdAt)

  function handleConfirmDelete() {
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deleteReviewAction({
        spaceId: review.spaceId,
        reviewId: review.id,
      })
      setIsDeleteOpen(false)
      if (result.status === 'success') {
        onFeedback(result.message ?? 'Review deleted.')
        return
      }
      const message = result.message ?? "This review can't be changed now"
      setDeleteError(message)
      onFeedback(message)
    })
  }

  return (
    <article
      data-testid={`author-review-${review.id}`}
      className="space-y-3 rounded-lg border border-border bg-background p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{reviewerShortName}</p>
            <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
              Checked-in visit
            </span>
            {review.edited && (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                Edited
              </span>
            )}
            {statusLabel && (
              <span
                data-testid={`author-review-status-${review.id}`}
                className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
              >
                {statusLabel}
              </span>
            )}
          </div>
          {postedDate && (
            <p className="text-xs text-muted-foreground">
              Reviewed <time dateTime={review.createdAt}>{postedDate}</time>
            </p>
          )}
        </div>

        <p className="text-sm font-semibold text-foreground">
          Overall {formatReviewScore(review.overall)} / 5
        </p>
      </div>

      {deleteError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {isEditing && canModify ? (
        <div className="pt-2">
          <ReviewForm
            mode="edit"
            action={editReviewAction}
            spaceId={review.spaceId}
            reviewId={review.id}
            idPrefix={`edit-review-${review.id}`}
            initialValues={{
              quietness: review.quietness,
              wifiReliability: review.wifiReliability,
              cleanliness: review.cleanliness,
              comfort: review.comfort,
              comment: review.comment,
            }}
            onCancel={() => setIsEditing(false)}
            onSuccess={(message) => {
              setIsEditing(false)
              onFeedback(message)
            }}
          />
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-2 text-xs">
            {REVIEW_RATING_CATEGORIES.map((category) => (
              <div
                key={category.key}
                className="min-w-0 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 break-words"
              >
                <dt className="text-muted-foreground">{category.label}</dt>
                <dd className="font-semibold text-foreground">
                  {review[category.key]} / 5
                </dd>
              </div>
            ))}
          </dl>

          {review.comment && (
            <p className="text-sm break-words whitespace-pre-wrap text-foreground">
              {review.comment}
            </p>
          )}

          {canModify && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteError(null)
                  setIsEditing(true)
                }}
                className="h-auto min-h-12 py-2 whitespace-normal"
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting}
                aria-busy={isDeleting}
                onClick={() => {
                  setDeleteError(null)
                  setIsDeleteOpen(true)
                }}
                className="h-auto min-h-12 py-2 whitespace-normal"
              >
                Delete
              </Button>
            </div>
          )}
        </>
      )}

      {canModify && (
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this review?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your review. You can post a new review for that
                visit later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isDeleting}
                aria-busy={isDeleting}
                onClick={handleConfirmDelete}
              >
                {isDeleting ? 'Deleting...' : 'Delete review'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </article>
  )
}

export interface AuthorReviewsSectionProps {
  spaceId: string
  viewerShortName: string
  reviewableVisit: ReviewableVisit | null
  myReviews: AuthorReview[]
}

/**
 * Wraps the "Write a review" panel, the Seeker's pinned own reviews, and a persistent
 * `aria-live="polite"` status region so post/edit/delete announcements survive page
 * revalidation even when the Write a review panel unmounts (STORY-13 design §3 Screen 1).
 */
export function AuthorReviewsSection({
  spaceId,
  viewerShortName,
  reviewableVisit,
  myReviews,
}: AuthorReviewsSectionProps) {
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const hasVisibleContent =
    reviewableVisit !== null || myReviews.length > 0 || announcement !== null

  return (
    <div className={hasVisibleContent ? 'space-y-6' : undefined}>
      <div
        role="status"
        aria-live="polite"
        data-testid="review-live-status"
        className={cn(
          announcement
            ? 'rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm font-medium text-foreground'
            : 'sr-only',
        )}
      >
        {announcement ?? ''}
      </div>

      {reviewableVisit && (
        <div
          data-testid="write-review-panel"
          className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 sm:p-5"
        >
          <div className="space-y-1">
            <h3 className="font-heading text-base font-semibold text-foreground">
              Write a review
            </h3>
            <p className="text-sm text-muted-foreground">
              Share your experience from your checked-in visit.
            </p>
          </div>
          <ReviewForm
            mode="create"
            action={postReviewAction}
            spaceId={spaceId}
            reservationId={reviewableVisit.reservationId}
            idPrefix="write-review"
            onSuccess={(message) => setAnnouncement(message)}
          />
        </div>
      )}

      {myReviews.length > 0 && (
        <div data-testid="author-reviews-group" className="space-y-3">
          <h3 className="font-heading text-base font-semibold text-foreground">
            {myReviews.length === 1 ? 'Your review' : 'Your reviews'}
          </h3>
          <div className="space-y-3">
            {myReviews.map((review) => (
              <AuthorReviewCard
                key={review.id}
                review={review}
                reviewerShortName={viewerShortName}
                onFeedback={(message) => setAnnouncement(message)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
