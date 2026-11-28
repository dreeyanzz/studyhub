import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

const REVIEW_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * Formats a numeric score (1..5) to one decimal place, rounding once for display (D-076).
 */
export function formatReviewScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return '—'
  }
  const rounded = Math.round((score + Number.EPSILON) * 10) / 10
  return rounded.toFixed(1)
}

/**
 * Formats a Space's overall rating and review count for the profile summary, SpaceCard,
 * and discovery map popup (STORY-13 design §3 Screens 1 & 4, D-076).
 */
export function formatReviewRating(
  average: number | null | undefined,
  count: number,
): { text: string; accessibleLabel: string; hasReviews: boolean } {
  if (
    count <= 0 ||
    average === null ||
    average === undefined ||
    !Number.isFinite(average)
  ) {
    return {
      text: 'No reviews yet',
      accessibleLabel: 'No reviews yet',
      hasReviews: false,
    }
  }

  const formattedAverage = formatReviewScore(average)
  const reviewWord = count === 1 ? 'review' : 'reviews'
  return {
    text: `${formattedAverage} · ${count} ${reviewWord}`,
    accessibleLabel: `Overall ${formattedAverage} out of 5, from ${count} ${reviewWord}`,
    hasReviews: true,
  }
}

/**
 * Formats a review's posted date in Asia/Manila (D-048, STORY-13 design §2:
 * "Reviewed 3 Nov 2026", never the visit's check-in date).
 */
export function formatReviewDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return REVIEW_DATE_FORMATTER.format(parsed)
}

const STAR_SLOTS = [1, 2, 3, 4, 5] as const

/**
 * Decorative 5-star solid rating strip supporting whole and fractional values
 * (e.g. 4.5 fills 4 full stars + 1 half star). Always paired with visible numeric
 * text so screen readers announce the exact score once without repetition.
 */
export function SolidStars({
  value,
  size = 'sm',
  className,
}: {
  value: number | null | undefined
  size?: 'xs' | 'sm'
  className?: string
}) {
  const safeValue =
    value !== null && value !== undefined && Number.isFinite(value)
      ? Math.max(0, Math.min(5, value))
      : 0
  const iconClass = size === 'xs' ? 'size-3' : 'size-4'

  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {STAR_SLOTS.map((slot) => {
        const fillRatio = Math.max(0, Math.min(1, safeValue - (slot - 1)))
        const fillPercent = Math.round(fillRatio * 100)

        return (
          <span key={slot} className={cn('relative inline-block shrink-0', iconClass)}>
            <Star
              className={cn(
                iconClass,
                'fill-muted-foreground/20 text-muted-foreground/20',
              )}
              strokeWidth={1.5}
            />
            {fillPercent > 0 && (
              <span
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }}
              >
                <Star
                  className={cn(iconClass, 'fill-star text-star-stroke')}
                  strokeWidth={1.5}
                />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

export interface ReviewRatingProps {
  average: number | null | undefined
  count: number
  className?: string
  'data-testid'?: string
}

/**
 * Shared overall rating + count display used by SpaceReviews and SpaceCard
 * (STORY-13 design §3, TSK-13.4, D-076).
 */
export function ReviewRating({
  average,
  count,
  className,
  'data-testid': testId,
}: ReviewRatingProps) {
  const { text, accessibleLabel, hasReviews } = formatReviewRating(average, count)

  if (!hasReviews) {
    return (
      <span
        data-testid={testId}
        className={cn(
          'inline-flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground',
          className,
        )}
      >
        {text}
      </span>
    )
  }

  return (
    <span
      role="img"
      aria-label={accessibleLabel}
      data-testid={testId}
      className={cn(
        'inline-flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground',
        className,
      )}
    >
      <Star className="size-4 shrink-0 fill-star text-star-stroke" aria-hidden="true" />
      <span aria-hidden="true">{text}</span>
    </span>
  )
}
