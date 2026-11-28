'use client'

import { useActionState, useId, useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_RATING_CATEGORIES,
  type ReviewActionState,
  type ReviewRatingCategoryKey,
} from '@/lib/validation/review'

const RATING_VALUES = [1, 2, 3, 4, 5] as const

const INITIAL_ACTION_STATE: ReviewActionState = {
  status: 'idle',
  message: null,
}

export interface ReviewFormValues {
  quietness?: number
  wifiReliability?: number
  cleanliness?: number
  comfort?: number
  comment?: string | null
}

export interface ReviewFormProps {
  action: (prevState: ReviewActionState, formData: FormData) => Promise<ReviewActionState>
  spaceId: string
  reservationId?: string
  reviewId?: string
  mode: 'create' | 'edit'
  initialValues?: ReviewFormValues
  onSuccess?: (message: string) => void
  onCancel?: () => void
  idPrefix?: string
}

/**
 * Shared review form for posting a new review or editing an existing visible review
 * (STORY-13 design §3 Screen 2, TSK-13.4, FR-4.1, D-087).
 *
 * Accepts its Server Action via props so STORY-16's reservation history dialog can
 * reuse the exact same form without duplicating inputs or rules.
 */
export function ReviewForm({
  action,
  spaceId,
  reservationId,
  reviewId,
  mode,
  initialValues,
  onSuccess,
  onCancel,
  idPrefix,
}: ReviewFormProps) {
  const reactId = useId()
  const prefix = idPrefix ?? reactId

  const [ratings, setRatings] = useState<Record<ReviewRatingCategoryKey, number | null>>({
    quietness: initialValues?.quietness ?? null,
    wifiReliability: initialValues?.wifiReliability ?? null,
    cleanliness: initialValues?.cleanliness ?? null,
    comfort: initialValues?.comfort ?? null,
  })
  const [comment, setComment] = useState<string>(initialValues?.comment ?? '')

  const [state, formAction, isPending] = useActionState(
    async (prevState: ReviewActionState, formData: FormData) => {
      const next = await action(prevState, formData)
      if (next.status === 'success') {
        onSuccess?.(
          next.message ?? (mode === 'create' ? 'Review posted.' : 'Review updated.'),
        )
      }
      return next
    },
    INITIAL_ACTION_STATE,
  )

  const remainingChars = Math.max(0, REVIEW_COMMENT_MAX_LENGTH - comment.length)
  const commentId = `${prefix}-comment`
  const commentCountId = `${prefix}-comment-count`
  const submitLabel = mode === 'create' ? 'Post review' : 'Save changes'

  return (
    <form action={formAction} noValidate className="space-y-5">
      <input type="hidden" name="spaceId" value={spaceId} />
      {reservationId && (
        <input type="hidden" name="reservationId" value={reservationId} />
      )}
      {reviewId && <input type="hidden" name="reviewId" value={reviewId} />}

      {state.status === 'error' && state.message && (
        <Alert
          variant="destructive"
          role="alert"
          data-testid="review-form-error"
          className="rounded-2xl border-destructive/30 shadow-xs"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Rate each category from 1 (low) to 5 (best).
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4">
        {REVIEW_RATING_CATEGORIES.map((category) => {
          const selected = ratings[category.key]
          const fieldError = state.fieldErrors?.[category.key]
          const errorId = `${prefix}-${category.key}-error`

          return (
            <fieldset
              key={category.key}
              className="space-y-2"
              aria-describedby={fieldError ? errorId : undefined}
            >
              <legend className="text-sm font-medium text-foreground">
                {category.label}
              </legend>
              <div className="flex flex-wrap gap-2">
                {RATING_VALUES.map((value) => {
                  const isSelected = selected === value
                  return (
                    <label
                      key={value}
                      className={cn(
                        'relative inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full border px-3 text-sm font-semibold shadow-2xs transition-all duration-150 select-none',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground shadow-card'
                          : 'border-border/80 bg-card text-foreground hover:-translate-y-0.5 hover:border-primary/45 hover:bg-surface-subtle',
                        isPending && 'pointer-events-none opacity-50',
                      )}
                    >
                      <input
                        type="radio"
                        name={category.key}
                        value={value}
                        checked={isSelected}
                        required
                        disabled={isPending}
                        onChange={() =>
                          setRatings((prev) => ({
                            ...prev,
                            [category.key]: value,
                          }))
                        }
                        aria-label={`${category.label} ${value} out of 5`}
                        className="sr-only"
                      />
                      <span aria-hidden="true">{value}</span>
                    </label>
                  )
                })}
              </div>
              {fieldError && (
                <p id={errorId} className="text-sm text-destructive">
                  {fieldError}
                </p>
              )}
            </fieldset>
          )
        })}
      </div>

      <div className="space-y-2">
        <label
          htmlFor={commentId}
          className="block px-1 text-sm font-medium text-foreground"
        >
          Comment (optional)
        </label>
        <textarea
          id={commentId}
          name="comment"
          rows={4}
          maxLength={REVIEW_COMMENT_MAX_LENGTH}
          value={comment}
          disabled={isPending}
          onChange={(event) => setComment(event.target.value)}
          aria-describedby={commentCountId}
          aria-invalid={state.fieldErrors?.comment ? 'true' : undefined}
          placeholder="Share how quiet, reliable, clean, and comfortable the Space felt."
          className="min-h-24 w-full rounded-2xl border border-input/90 bg-card px-4 py-3 text-sm text-foreground shadow-2xs transition-colors placeholder:text-muted-foreground hover:border-primary/40 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p id={commentCountId} className="text-xs text-muted-foreground">
            {remainingChars} / {REVIEW_COMMENT_MAX_LENGTH} characters remaining
          </p>
          {state.fieldErrors?.comment && (
            <p className="text-sm text-destructive">{state.fieldErrors.comment}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="h-auto min-h-12 rounded-full px-6 py-2 font-semibold whitespace-normal"
        >
          {isPending ? 'Saving...' : submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="h-auto min-h-12 rounded-full px-5 py-2 whitespace-normal"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
