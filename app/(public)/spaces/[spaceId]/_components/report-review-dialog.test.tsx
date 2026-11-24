import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ReportReviewDialog, ReportReviewForm } from './report-review-dialog'

vi.mock('../actions', () => ({
  reportReviewAction: vi.fn(),
}))

const SPACE_ID = 'e0000000-0000-4000-8000-000000000001'
const REVIEW_ID = 'a1000000-0000-4000-8000-000000000001'

describe('ReportReviewDialog and ReportReviewForm (STORY-13, TSK-13.5, FR-4.2, D-080)', () => {
  it('renders a 48px Report button and polite live region when not yet reported', () => {
    const html = renderToStaticMarkup(
      <ReportReviewDialog
        spaceId={SPACE_ID}
        reviewId={REVIEW_ID}
        reportedByCaller={false}
      />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain(`data-testid="report-review-trigger-${REVIEW_ID}"`)
    expect(html).toContain('min-h-12')
    expect(html).toContain('Report')
    expect(html).not.toContain('You reported this')
  })

  it('renders "You reported this" instead of the Report button when reportedByCaller is true', () => {
    const html = renderToStaticMarkup(
      <ReportReviewDialog spaceId={SPACE_ID} reviewId={REVIEW_ID} reportedByCaller />,
    )

    expect(html).toContain('You reported this')
    expect(html).not.toContain(`data-testid="report-review-trigger-${REVIEW_ID}"`)
  })

  it('renders four 48px reason radios, 300-char note counter, Submit report, and Cancel', () => {
    const html = renderToStaticMarkup(
      <ReportReviewForm
        spaceId={SPACE_ID}
        reviewId={REVIEW_ID}
        idPrefix="report-test"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(html).toContain('<legend')
    expect(html).toContain('Reason')
    expect(html).toContain('Spam')
    expect(html).toContain('Offensive')
    expect(html).toContain('Not about this Space')
    expect(html).toContain('Other')
    expect(html).toMatch(/\bmin-h-12\b/)
    expect(html).toMatch(/\bmin-w-12\b/)
    expect(html).toContain('Note (optional)')
    expect(html).toContain('maxLength="300"')
    expect(html).toContain('300 / 300 characters remaining')
    expect(html).toContain('Submit report')
    expect(html).toContain('Cancel')
    expect(html).toContain(`value="${SPACE_ID}"`)
    expect(html).toContain(`value="${REVIEW_ID}"`)
  })
})
