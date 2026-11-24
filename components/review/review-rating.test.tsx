import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  formatReviewDate,
  formatReviewRating,
  formatReviewScore,
  ReviewRating,
} from './review-rating'

describe('ReviewRating helpers and component (STORY-13, TSK-13.4, D-076)', () => {
  it('formats overall rating and plural count, rounding once to one decimal place', () => {
    expect(formatReviewRating(4.25, 2)).toEqual({
      text: '4.3 · 2 reviews',
      accessibleLabel: 'Overall 4.3 out of 5, from 2 reviews',
      hasReviews: true,
    })
  })

  it('uses singular "1 review" when count is 1', () => {
    expect(formatReviewRating(4, 1)).toEqual({
      text: '4.0 · 1 review',
      accessibleLabel: 'Overall 4.0 out of 5, from 1 review',
      hasReviews: true,
    })
  })

  it('returns "No reviews yet" when count is 0 or average is null', () => {
    expect(formatReviewRating(null, 0)).toEqual({
      text: 'No reviews yet',
      accessibleLabel: 'No reviews yet',
      hasReviews: false,
    })
    expect(formatReviewRating(4.5, 0).hasReviews).toBe(false)
    expect(formatReviewRating(null, 3).hasReviews).toBe(false)
  })

  it('formats category scores and handles null safely', () => {
    expect(formatReviewScore(4.25)).toBe('4.3')
    expect(formatReviewScore(5)).toBe('5.0')
    expect(formatReviewScore(null)).toBe('—')
  })

  it('formats review posted dates in Asia/Manila (D-048)', () => {
    // 2026-11-03T16:30:00Z is 2026-11-04 00:30 in Asia/Manila (UTC+8).
    expect(formatReviewDate('2026-11-03T16:30:00Z')).toBe('4 Nov 2026')
    expect(formatReviewDate('2026-11-03T06:00:00Z')).toBe('3 Nov 2026')
  })

  it('renders ReviewRating with accessible label and formatted text', () => {
    const html = renderToStaticMarkup(<ReviewRating average={4.25} count={2} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Overall 4.3 out of 5, from 2 reviews"')
    expect(html).toContain('4.3 · 2 reviews')
  })

  it('renders "No reviews yet" cleanly when count is 0', () => {
    const html = renderToStaticMarkup(<ReviewRating average={null} count={0} />)
    expect(html).toContain('No reviews yet')
    expect(html).not.toContain('role="img"')
  })
})
