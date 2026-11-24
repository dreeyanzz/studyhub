import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type {
  AuthorReview,
  SpaceReviewItem,
  SpaceReviewSummary,
} from '@/lib/data/reviews'
import { buildReviewsHref, SpaceReviews } from './space-reviews'

vi.mock('../actions', () => ({
  postReviewAction: vi.fn(),
  editReviewAction: vi.fn(),
  deleteReviewAction: vi.fn(),
}))

const SPACE_ID = 'e0000000-0000-4000-8000-000000000001'

function makeSummary(overrides: Partial<SpaceReviewSummary> = {}): SpaceReviewSummary {
  return {
    spaceId: SPACE_ID,
    reviewCount: 2,
    avgQuietness: 4.5,
    avgWifiReliability: 4.0,
    avgCleanliness: 4.5,
    avgComfort: 4.0,
    avgOverall: 4.25,
    ...overrides,
  }
}

function makeReview(overrides: Partial<SpaceReviewItem> = {}): SpaceReviewItem {
  return {
    id: 'rev-1',
    reviewerName: 'Rina B.',
    quietness: 5,
    wifiReliability: 4,
    cleanliness: 5,
    comfort: 4,
    overall: 4.5,
    comment: 'Clean tables and reliable Wi-Fi.',
    createdAt: '2026-11-10T06:00:00Z',
    edited: false,
    version: 1,
    reportedByCaller: false,
    ...overrides,
  }
}

function makeAuthorReview(overrides: Partial<AuthorReview> = {}): AuthorReview {
  return {
    id: 'my-rev-1',
    reservationId: 'res-1',
    spaceId: SPACE_ID,
    quietness: 5,
    wifiReliability: 5,
    cleanliness: 4,
    comfort: 4,
    overall: 4.5,
    comment: 'Solid study spot.',
    status: 'visible',
    version: 1,
    edited: false,
    editedAt: null,
    createdAt: '2026-11-12T06:00:00Z',
    ...overrides,
  }
}

describe('SpaceReviews (STORY-13, TSK-13.4, FR-4.1, SRS §3.5.2)', () => {
  it('renders averages, category scores, sort links preserving view/unit, and reviews', () => {
    const html = renderToStaticMarkup(
      <SpaceReviews
        spaceId={SPACE_ID}
        summary={makeSummary()}
        reviewsPage={{
          reviews: [makeReview({ edited: true })],
          hasMore: true,
        }}
        myReviews={[]}
        reviewableVisit={null}
        viewerShortName="Worq Seeker"
        sort="highest"
        shown={10}
        view="list"
        unit="u-1"
      />,
    )

    expect(html).toContain('aria-labelledby="reviews-heading"')
    expect(html).toContain('4.3 · 2 reviews')
    expect(html).toContain('Overall 4.3 out of 5, from 2 reviews')
    expect(html).toContain('Quietness')
    expect(html).toContain('Wi-Fi reliability')
    expect(html).toContain('Cleanliness')
    expect(html).toContain('Comfort')
    expect(html).toContain('4.5 / 5')
    expect(html).toContain('4.0 / 5')
    // Active sort has aria-current="page" and preserves view, unit, reviews
    expect(html).toMatch(
      new RegExp(
        `<a aria-current="page"[^>]*href="/spaces/${SPACE_ID}\\?view=list&amp;unit=u-1&amp;sort=highest&amp;reviews=10">Highest rated</a>`,
      ),
    )
    expect(html).toContain('Rina B.')
    expect(html).toContain('Checked-in visit')
    expect(html).toContain(
      'Reviewed <time dateTime="2026-11-10T06:00:00Z">10 Nov 2026</time>',
    )
    expect(html).toContain('Edited')
    // Show more link steps from 10 -> 20
    expect(html).toContain('Show more reviews')
    expect(html).toContain(
      `href="/spaces/${SPACE_ID}?view=list&amp;unit=u-1&amp;sort=highest&amp;reviews=20"`,
    )
  })

  it('renders <script>alert(1)</script> comments as escaped plain text, never executable markup (SRS §3.5.2)', () => {
    const payload = '<script>alert(1)</script>'
    const html = renderToStaticMarkup(
      <SpaceReviews
        spaceId={SPACE_ID}
        summary={makeSummary()}
        reviewsPage={{
          reviews: [makeReview({ comment: payload })],
          hasMore: false,
        }}
        myReviews={[makeAuthorReview({ comment: payload })]}
        reviewableVisit={null}
        viewerShortName="Juan C."
        sort="newest"
        shown={10}
      />,
    )

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('replaces "Show more reviews" with the 50-review cap notice at 50 when hasMore is true', () => {
    const html = renderToStaticMarkup(
      <SpaceReviews
        spaceId={SPACE_ID}
        summary={makeSummary({ reviewCount: 60 })}
        reviewsPage={{
          reviews: [makeReview()],
          hasMore: true,
        }}
        myReviews={[]}
        reviewableVisit={null}
        viewerShortName="Worq Seeker"
        sort="newest"
        shown={50}
      />,
    )

    expect(html).toContain('Showing the first 50 reviews in this order.')
    expect(html).not.toContain('Show more reviews')
  })

  it('renders empty state when reviewCount is 0 and omits "No other reviews yet."', () => {
    const html = renderToStaticMarkup(
      <SpaceReviews
        spaceId={SPACE_ID}
        summary={makeSummary({
          reviewCount: 0,
          avgQuietness: null,
          avgWifiReliability: null,
          avgCleanliness: null,
          avgComfort: null,
          avgOverall: null,
        })}
        reviewsPage={{ reviews: [], hasMore: false }}
        myReviews={[]}
        reviewableVisit={null}
        viewerShortName="Worq Seeker"
        sort="newest"
        shown={10}
      />,
    )

    expect(html).toContain('No reviews yet')
    expect(html).toContain('Be the first to review after checking in.')
    expect(html).not.toContain('No other reviews yet.')
  })

  it('renders "No other reviews yet." when summary has reviews but others list is empty', () => {
    const html = renderToStaticMarkup(
      <SpaceReviews
        spaceId={SPACE_ID}
        summary={makeSummary({ reviewCount: 1 })}
        reviewsPage={{ reviews: [], hasMore: false }}
        myReviews={[makeAuthorReview()]}
        reviewableVisit={null}
        viewerShortName="Juan C."
        sort="newest"
        shown={10}
      />,
    )

    expect(html).toContain('Your review')
    expect(html).toContain('No other reviews yet.')
  })

  it('renders error alert when summary or reviews fail to load', () => {
    const html = renderToStaticMarkup(
      <SpaceReviews
        spaceId={SPACE_ID}
        summary={null}
        reviewsPage={null}
        myReviews={null}
        reviewableVisit={null}
        viewerShortName="Worq Seeker"
        sort="newest"
        shown={10}
      />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain(
      'We couldn&#x27;t load reviews right now. Refresh the page to try again.',
    )
  })

  it('pins Write a review and author cards with Edited and Administrator moderation labels (D-080)', () => {
    const html = renderToStaticMarkup(
      <SpaceReviews
        spaceId={SPACE_ID}
        summary={makeSummary()}
        reviewsPage={{ reviews: [], hasMore: false }}
        myReviews={[
          makeAuthorReview({ id: 'vis', status: 'visible', edited: true }),
          makeAuthorReview({ id: 'hid', status: 'hidden' }),
          makeAuthorReview({ id: 'rem', status: 'removed' }),
        ]}
        reviewableVisit={{
          reservationId: 'res-new',
          checkedInAt: '2026-11-14T08:00:00Z',
        }}
        viewerShortName="Juan C."
        sort="newest"
        shown={10}
      />,
    )

    expect(html).toContain('Write a review')
    expect(html).toContain('Your reviews')
    expect(html).toContain('Edited')
    expect(html).toContain('Hidden by an Administrator')
    expect(html).toContain('Removed by an Administrator')
    // Edit and Delete buttons appear only once (for the visible review, not hidden/removed)
    expect([...html.matchAll(/>Edit<\/button>/g)]).toHaveLength(1)
    expect([...html.matchAll(/>Delete<\/button>/g)]).toHaveLength(1)
  })

  it('builds review query URLs cleanly', () => {
    expect(
      buildReviewsHref(SPACE_ID, {
        sort: 'lowest',
        reviews: 30,
        view: 'list',
        unit: 'u-1',
      }),
    ).toBe(`/spaces/${SPACE_ID}?view=list&unit=u-1&sort=lowest&reviews=30`)
  })
})
