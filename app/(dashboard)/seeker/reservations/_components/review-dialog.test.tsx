import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ReviewDialog } from './review-dialog'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/app/(public)/spaces/[spaceId]/actions', () => ({
  postReviewAction: vi.fn(),
  editReviewAction: vi.fn(),
}))

const SPACE_ID = 'e0000000-0000-4000-8000-000000000001'
const RESERVATION_ID = '10000000-0000-4000-8000-000000000001'
const REVIEW_ID = 'a0000000-0000-4000-8000-000000000001'

// The dialog's opening, focus trap, refresh and announcement need a browser, so
// TSK-16.5's e2e/history.spec.ts walks them. These cover what renders before it opens.
describe('ReviewDialog (STORY-16 design §3 Screen 4, TSK-16.4)', () => {
  it('renders a 48 px Leave a review button and an empty polite live region in create mode', () => {
    const html = renderToStaticMarkup(
      <ReviewDialog
        mode="create"
        spaceId={SPACE_ID}
        spaceName="Kapihan Study Hall"
        reservationId={RESERVATION_ID}
      />,
    )

    expect(html).toContain(`data-testid="leave-review-${RESERVATION_ID}"`)
    expect(html).toContain('Leave a review')
    expect(html).toMatch(/\bmin-h-12\b/)
    expect(html).toMatch(/\bmin-w-12\b/)
    expect(html).toMatch(
      /<span role="status" aria-live="polite" data-testid="review-live-status" class="sr-only"><\/span>/,
    )
    expect(html).not.toContain('Edit your review')
  })

  it('renders an Edit your review button in edit mode', () => {
    const html = renderToStaticMarkup(
      <ReviewDialog
        mode="edit"
        spaceId={SPACE_ID}
        spaceName="Kapihan Study Hall"
        reviewId={REVIEW_ID}
        initialValues={{ quietness: 4, wifiReliability: 5, cleanliness: 4, comfort: 3 }}
      />,
    )

    expect(html).toContain(`data-testid="edit-review-${REVIEW_ID}"`)
    expect(html).toContain('Edit your review')
    expect(html).not.toContain('Leave a review')
  })

  it('keeps the dialog and its form unrendered until the button is pressed', () => {
    const html = renderToStaticMarkup(
      <ReviewDialog
        mode="create"
        spaceId={SPACE_ID}
        spaceName="Kapihan Study Hall"
        reservationId={RESERVATION_ID}
      />,
    )

    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain('Post review')
  })
})
