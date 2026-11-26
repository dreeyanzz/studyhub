import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReservationHistoryItem } from '@/lib/data/history'
import * as historyData from '@/lib/data/history'

import ReservationHistoryPage from './page'

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({ refresh: vi.fn() }),
}))

// HistoryRow's ReviewDialog (TSK-16.4) imports STORY-13's Server Actions.
vi.mock('@/app/(public)/spaces/[spaceId]/actions', () => ({
  postReviewAction: vi.fn(),
  editReviewAction: vi.fn(),
}))

let mockUser: { id: string } | null = { id: 'c0000000-0000-4000-8000-000000000001' }

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
  })),
}))

const fakeItem: ReservationHistoryItem = {
  reservationId: '10000000-0000-4000-8000-000000000001',
  reservationStatus: 'completed',
  createdAt: '2026-11-20T10:00:00.000Z',
  checkedInAt: '2026-11-20T10:15:00.000Z',
  endedAt: '2026-11-20T12:00:00.000Z',
  spaceId: 'e0000000-0000-4000-8000-000000000001',
  spaceName: 'Kapihan Study Hall',
  spaceListed: true,
  unitId: 'u0000000-0000-4000-8000-000000000001',
  unitLabel: 'Desk 1',
  paymentStatus: 'paid',
  feeAmount: 5000,
  refundedAt: null,
  reviewId: null,
  reviewStatus: null,
}

describe('ReservationHistoryPage (STORY-16 design §3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: 'c0000000-0000-4000-8000-000000000001' }
  })

  it('redirects to /login when user is not signed in', async () => {
    mockUser = null
    await expect(ReservationHistoryPage({})).rejects.toThrow(
      'NEXT_REDIRECT:/login?returnUrl=%2Fseeker%2Freservations',
    )
  })

  it('renders error alert when history cannot be loaded', async () => {
    vi.spyOn(historyData, 'getReservationHistory').mockResolvedValue(null)

    const jsx = await ReservationHistoryPage({})
    const html = renderToStaticMarkup(jsx)

    expect(html).toContain('role="alert"')
    expect(html).toContain(
      'We couldn&#x27;t load your reservation history. Refresh the page to try again.',
    )
  })

  it('renders empty state when there are no past reservations', async () => {
    vi.spyOn(historyData, 'getReservationHistory').mockResolvedValue({
      items: [],
      hasMore: false,
    })

    const jsx = await ReservationHistoryPage({})
    const html = renderToStaticMarkup(jsx)

    expect(html).toContain('No past reservations yet')
    expect(html).toContain(
      'Your completed, cancelled, and refunded holds will appear here.',
    )
    expect(html).toContain('href="/spaces"')
    expect(html).toContain('Find a Space')
  })

  it('renders list of past reservations when data is present', async () => {
    vi.spyOn(historyData, 'getReservationHistory').mockResolvedValue({
      items: [fakeItem],
      hasMore: false,
    })

    const jsx = await ReservationHistoryPage({})
    const html = renderToStaticMarkup(jsx)

    expect(html).toContain('Reservation history')
    expect(html).toContain('Kapihan Study Hall')
    expect(html).toContain('Visit completed')
    expect(html).toContain('Desk 1')
  })

  it('reads only the visible reviews on the rows shown and offers Edit your review (TSK-16.4)', async () => {
    const visibleItem: ReservationHistoryItem = {
      ...fakeItem,
      reviewId: 'a0000000-0000-4000-8000-000000000001',
      reviewStatus: 'visible',
    }
    const hiddenItem: ReservationHistoryItem = {
      ...fakeItem,
      reservationId: '10000000-0000-4000-8000-000000000002',
      reviewId: 'a0000000-0000-4000-8000-000000000002',
      reviewStatus: 'hidden',
    }
    vi.spyOn(historyData, 'getReservationHistory').mockResolvedValue({
      items: [visibleItem, hiddenItem],
      hasMore: false,
    })
    const valuesSpy = vi.spyOn(historyData, 'getMyHistoryReviewValues').mockResolvedValue(
      new Map([
        [
          'a0000000-0000-4000-8000-000000000001',
          {
            quietness: 4,
            wifiReliability: 5,
            cleanliness: 4,
            comfort: 3,
            comment: null,
          },
        ],
      ]),
    )

    const html = renderToStaticMarkup(await ReservationHistoryPage({}))

    expect(valuesSpy).toHaveBeenCalledWith(expect.anything(), mockUser!.id, [
      'a0000000-0000-4000-8000-000000000001',
    ])
    expect(html).toContain(
      'data-testid="edit-review-a0000000-0000-4000-8000-000000000001"',
    )
    expect(html).toContain('Review hidden by an Administrator')
    expect(html).not.toContain(
      'data-testid="edit-review-a0000000-0000-4000-8000-000000000002"',
    )
  })

  it('skips the review read when no row has a visible review', async () => {
    vi.spyOn(historyData, 'getReservationHistory').mockResolvedValue({
      items: [fakeItem],
      hasMore: false,
    })
    const valuesSpy = vi.spyOn(historyData, 'getMyHistoryReviewValues')

    const html = renderToStaticMarkup(await ReservationHistoryPage({}))

    expect(valuesSpy).not.toHaveBeenCalled()
    expect(html).toContain('Leave a review')
  })

  it('renders Show more link when hasMore is true and show < 100', async () => {
    vi.spyOn(historyData, 'getReservationHistory').mockResolvedValue({
      items: [fakeItem],
      hasMore: true,
    })

    const jsx = await ReservationHistoryPage({
      searchParams: Promise.resolve({ show: '20' }),
    })
    const html = renderToStaticMarkup(jsx)

    expect(html).toContain('href="/seeker/reservations?show=40"')
    expect(html).toContain('Show more')
  })

  it('renders 100 reservations notice when at 100 and hasMore is true', async () => {
    vi.spyOn(historyData, 'getReservationHistory').mockResolvedValue({
      items: [fakeItem],
      hasMore: true,
    })

    const jsx = await ReservationHistoryPage({
      searchParams: Promise.resolve({ show: '100' }),
    })
    const html = renderToStaticMarkup(jsx)

    expect(html).not.toContain('Show more')
    expect(html).toContain('Showing your newest 100 past reservations.')
  })
})
