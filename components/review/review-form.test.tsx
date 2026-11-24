import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ReviewForm } from './review-form'

const SPACE_ID = 'e0000000-0000-4000-8000-000000000001'
const RESERVATION_ID = 'f1000000-0000-4000-8000-000000000001'
const REVIEW_ID = 'a1000000-0000-4000-8000-000000000001'

describe('ReviewForm component (STORY-13, TSK-13.4, FR-4.1, D-087)', () => {
  it('renders four required 1-5 radio fieldsets, optional 500-char comment, and Post review CTA', () => {
    const html = renderToStaticMarkup(
      <ReviewForm
        mode="create"
        action={vi.fn()}
        spaceId={SPACE_ID}
        reservationId={RESERVATION_ID}
        idPrefix="test-create"
      />,
    )

    expect(html).toContain('<legend')
    expect(html).toContain('Quietness')
    expect(html).toContain('Wi-Fi reliability')
    expect(html).toContain('Cleanliness')
    expect(html).toContain('Comfort')
    expect(html).toContain('aria-label="Quietness 1 out of 5"')
    expect(html).toContain('aria-label="Quietness 5 out of 5"')
    expect(html).toContain('aria-label="Comfort 5 out of 5"')
    // Every radio control label enforces >= 48 x 48 px hit area (D-093).
    expect(html).toContain('min-h-12 min-w-12')
    expect(html).toContain('Comment (optional)')
    expect(html).toContain('maxLength="500"')
    expect(html).toContain('500 / 500 characters remaining')
    expect(html).toContain('Post review')
    expect(html).toContain(`value="${SPACE_ID}"`)
    expect(html).toContain(`value="${RESERVATION_ID}"`)
    expect(html).not.toContain('>Cancel<')
  })

  it('prefills ratings and comment in edit mode and renders Save changes + Cancel', () => {
    const html = renderToStaticMarkup(
      <ReviewForm
        mode="edit"
        action={vi.fn()}
        spaceId={SPACE_ID}
        reviewId={REVIEW_ID}
        idPrefix="test-edit"
        initialValues={{
          quietness: 5,
          wifiReliability: 4,
          cleanliness: 3,
          comfort: 5,
          comment: 'Great desks',
        }}
        onCancel={vi.fn()}
      />,
    )

    expect(html).toContain(`value="${REVIEW_ID}"`)
    expect(html).toContain('Great desks')
    expect(html).toContain('489 / 500 characters remaining')
    expect(html).toContain('Save changes')
    expect(html).toContain('Cancel')
  })
})
