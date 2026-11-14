import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SeatMapZone } from '@/lib/seat-map/grid'
import SpaceProfilePage, { generateMetadata } from './page'

// Mock next/navigation
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}))

const VALID_SPACE_ID = 'e0000000-0000-4000-8000-000000000001'

interface MockSpaceData {
  id: string
  name: string
  description: string | null
  address: string
  opens_at: string
  closes_at: string
  price_tier: 'free' | 'budget' | 'standard' | 'premium'
  status: 'verified' | 'pending' | 'rejected'
}

let mockSpace: MockSpaceData | null = null
let mockZones: SeatMapZone[] = []
let mockStorageFiles: Array<{ name: string; created_at?: string }> = []
let mockCuratedTags: unknown[] = []
let mockCustomTags: unknown[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === 'space_curated_tags') {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn((col: string, val: unknown) =>
            Promise.resolve({
              data: col === 'space_id' && val === mockSpace?.id ? mockCuratedTags : [],
              error: null,
            }),
          ),
        }
        return builder
      }
      if (table === 'space_custom_tags') {
        const filters: Record<string, unknown> = {}
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn((col: string, val: unknown) => {
            filters[col] = val
            return builder
          }),
          order: vi.fn(() =>
            Promise.resolve({
              data: filters.space_id === mockSpace?.id ? mockCustomTags : [],
              error: null,
            }),
          ),
        }
        return builder
      }
      if (table !== 'spaces') throw new Error(`Unexpected table ${table}`)
      const filters: Record<string, unknown> = {}
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: unknown) => {
          filters[col] = val
          return builder
        }),
        maybeSingle: vi.fn(async () => {
          if (mockSpace && filters.id === mockSpace.id) {
            return { data: mockSpace, error: null }
          }
          return { data: null, error: null }
        }),
      }
      return builder
    }),
    storage: {
      from: vi.fn((bucket: string) => {
        if (bucket !== 'space-photos') throw new Error(`Unexpected bucket ${bucket}`)
        return {
          list: vi.fn(async () => ({ data: mockStorageFiles, error: null })),
          getPublicUrl: vi.fn((path: string) => ({
            data: {
              publicUrl: `https://example.supabase.co/storage/v1/object/public/space-photos/${path}`,
            },
          })),
        }
      }),
    },
  })),
}))

vi.mock('@/lib/data/seat-map', () => ({
  getSeatMap: vi.fn(async () => mockZones),
}))

// STORY-09's hold panel (TSK-09.6): its terms and viewer, and its action as a form target.
let mockHoldTerms: unknown = null
let mockViewer: unknown = { role: null, currentHold: null }
vi.mock('@/lib/data/reservations', () => ({
  getHoldTerms: vi.fn(async () => mockHoldTerms),
  getHoldViewer: vi.fn(async () => mockViewer),
}))
vi.mock('./actions', () => ({ holdUnit: vi.fn() }))

describe('SpaceProfilePage (STORY-11, TSK-11.3)', () => {
  beforeEach(() => {
    // The open/closed badge reads the clock, so pin it to noon in Manila. Without
    // this, the closed-notice test failed whenever it ran between 01:00 and 02:00.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T12:00:00+08:00'))
    mockNotFound.mockClear()
    mockHoldTerms = null
    mockViewer = { role: null, currentHold: null }
    mockStorageFiles = []
    mockCuratedTags = []
    mockCustomTags = []
    mockSpace = {
      id: VALID_SPACE_ID,
      name: 'Kapihan Study Hall',
      description: 'A quiet study haven with premium coffee.',
      address: '123 Colon Street, Cebu City',
      opens_at: '00:00:00',
      closes_at: '00:00:00', // Open 24 hours so it's open by default
      price_tier: 'budget',
      status: 'verified',
    }
    mockZones = [
      {
        id: 'z1',
        name: 'Main Hall',
        position: 0,
        units: [
          {
            id: 'u1',
            unitType: 'seat',
            label: 'D1',
            capacity: 1,
            row: 0,
            col: 0,
            colSpan: 1,
            seatState: 'available',
            hostUpdatedAt: '2026-11-09T10:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
        ],
      },
    ]
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns notFound when spaceId is not a valid UUID', async () => {
    await expect(
      SpaceProfilePage({
        params: Promise.resolve({ spaceId: 'not-a-valid-uuid' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('returns notFound when space does not exist', async () => {
    mockSpace = null
    await expect(
      SpaceProfilePage({
        params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('returns notFound when space status is pending (D-055)', async () => {
    mockSpace = {
      ...mockSpace!,
      status: 'pending',
    }
    await expect(
      SpaceProfilePage({
        params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('returns notFound when space status is rejected (D-055)', async () => {
    mockSpace = {
      ...mockSpace!,
      status: 'rejected',
    }
    await expect(
      SpaceProfilePage({
        params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders verified space profile shell with header, breadcrumb and no notices when open with available units', async () => {
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('Kapihan Study Hall')
    expect(html).toContain('123 Colon Street, Cebu City')
    expect(html).toContain('A quiet study haven with premium coffee.')
    expect(html).toContain('Back to search')
    // Every link back goes to discovery search, which lives at /spaces (STORY-08)
    expect(html).toContain('href="/spaces"')
    expect(html).not.toContain('href="/"')
    expect(html).toContain('Open 24 hours')
    expect(html).toContain('data-testid="price-tier-badge-budget"')
    expect(html).toContain('Budget (₱)')
    // No closed or empty notice
    expect(html).not.toContain('This Space is closed now')
    expect(html).not.toContain('No units are currently Available')
  })

  it('shows no closed notice inside daytime operating hours', async () => {
    // Noon in Manila (beforeEach) falls inside 08:00 to 22:00
    mockSpace = {
      ...mockSpace!,
      opens_at: '08:00:00',
      closes_at: '22:00:00',
    }

    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('Open now · Closes at 22:00')
    expect(html).not.toContain('This Space is closed now')
  })

  it('renders closed notice with link to search when space is closed (seeker-space-closed)', async () => {
    // Noon in Manila (beforeEach) falls outside 01:00 to 02:00
    mockSpace = {
      ...mockSpace!,
      opens_at: '01:00:00',
      closes_at: '02:00:00',
    }

    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('This Space is closed now')
    expect(html).toContain(
      'You can review seats and amenities; reservations open during operating hours.',
    )
    expect(html).toContain('Closed · Opens tomorrow at 01:00')
    expect(html).toContain('Explore other spaces')
    expect(html).toContain('data-testid="seeker-space-closed"')
    expect(html).not.toContain('href="/"')
  })

  it('renders no available units notice when all units are occupied (seeker-profile-no-available-unit)', async () => {
    mockZones = [
      {
        id: 'z1',
        name: 'Main Hall',
        position: 0,
        units: [
          {
            id: 'u1',
            unitType: 'seat',
            label: 'D1',
            capacity: 1,
            row: 0,
            col: 0,
            colSpan: 1,
            seatState: 'occupied',
            hostUpdatedAt: '2026-11-09T10:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
        ],
      },
    ]

    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('No units available')
    expect(html).toContain('No units are currently Available. Check back later or')
    expect(html).toContain('explore other spaces')
    expect(html).toContain('data-testid="seeker-profile-no-available-unit"')
    expect(html).not.toContain('href="/"')
  })

  it('renders photo gallery empty fallback when space has no uploaded photos', async () => {
    mockStorageFiles = []
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('data-testid="space-photos-empty"')
    expect(html).toContain('No Space photos uploaded yet')
  })

  it('renders photo gallery carousel with cover image when storage photos exist', async () => {
    mockStorageFiles = [
      { name: 'cover.jpg', created_at: '2026-11-01T00:00:00Z' },
      { name: 'interior.jpg', created_at: '2026-11-02T00:00:00Z' },
    ]
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('role="region"')
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain(`alt="Photo of ${mockSpace!.name} (1 of 2)"`)
    expect(html).toContain('1 / 2')
    expect(html).toContain('aria-label="Photo thumbnails"')
  })

  it('renders curated and custom tags on space profile in deterministic category and display_order sequence (TSK-11.6)', async () => {
    mockCuratedTags = [
      {
        tag_id: 'ac_full',
        curated_tags: {
          id: 'ac_full',
          category: 'ac',
          label: 'Air Conditioning',
          display_order: 1,
        },
      },
      {
        tag_id: 'wifi_fast',
        curated_tags: {
          id: 'wifi_fast',
          category: 'wifi',
          label: 'Wi-Fi: Fast (50+ Mbps)',
          display_order: 2,
        },
      },
      {
        tag_id: 'wifi_basic',
        curated_tags: {
          id: 'wifi_basic',
          category: 'wifi',
          label: 'Wi-Fi: Basic',
          display_order: 1,
        },
      },
    ]
    mockCustomTags = [{ name: 'coffee-available' }]

    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('data-testid="space-tags"')
    expect(html).toContain('data-testid="curated-tags"')
    expect(html).toContain('Wi-Fi: Basic')
    expect(html).toContain('Wi-Fi: Fast (50+ Mbps)')
    expect(html).toContain('Air Conditioning')
    // Deterministic order: wifi (display_order 1 -> 2) before ac
    expect(html.indexOf('Wi-Fi: Basic')).toBeLessThan(
      html.indexOf('Wi-Fi: Fast (50+ Mbps)'),
    )
    expect(html.indexOf('Wi-Fi: Fast (50+ Mbps)')).toBeLessThan(
      html.indexOf('Air Conditioning'),
    )
    expect(html).toContain('data-testid="custom-tags"')
    expect(html).toContain('<span aria-hidden="true">#</span>coffee-available')

    // Heading hierarchy invariant (axe-core heading-order): h1 -> h2 without skipping levels
    const headingLevels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]))
    expect(headingLevels[0]).toBe(1)
    for (let i = 1; i < headingLevels.length; i++) {
      expect(headingLevels[i]).toBeLessThanOrEqual(headingLevels[i - 1]! + 1)
    }
  })

  it('renders zone availability summary and seat map on profile page (TSK-11.5)', async () => {
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('Current Availability')
    expect(html).toContain('Main Hall:')
    expect(html).toContain('1 available')
    expect(html).toContain('1 total')
    expect(html).toContain('data-testid="space-seat-map-view"')
    expect(html).toContain('Seat Selection')
    expect(html).toContain('Seat map')
    expect(html).toContain('Accessible list')
  })

  it('renders accessible list view when searchParams contains view=list (SRS §3.2.2)', async () => {
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({ view: 'list' }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('data-testid="space-unit-list"')
    expect(html).toContain('Main Hall')
    expect(html).toContain('D1')
  })

  it('renders selected unit panel when searchParams contains unit=<id>', async () => {
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({ unit: 'u1' }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('data-testid="selected-unit-panel"')
    expect(html).toContain('Selected Unit: D1')
    expect(html).toContain('Main Hall')
  })

  it('puts the hold panel in the selected unit slot, with sign-in back to this profile (STORY-09)', async () => {
    mockHoldTerms = {
      feeAmount: 5000,
      paymentWindowMinutes: 10,
      maxWaitWindowMinutes: 60,
      isOpen: true,
      nextClosingAt: null,
      waitWindowMinutes: [15, 30, 45, 60],
    }
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({ unit: 'u1' }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('Reservation fee: ₱50.00.')
    expect(html).toContain('Holding a unit needs a Seeker account.')
    expect(html).toContain(`href="/login?returnUrl=%2Fspaces%2F${VALID_SPACE_ID}"`)
  })

  it('shows holdUnit’s refusal above the seat map, worded for the unit (design §3)', async () => {
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({ unit: 'u1', refused: 'unit_not_available' }),
    })
    const html = renderToStaticMarkup(page)
    expect(html).toContain('data-testid="hold-refusal"')
    expect(html).toContain('Someone else just took D1. Pick another unit.')
  })

  it('ignores a refused value that is not a known reason', async () => {
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({ unit: 'u1', refused: '<b>hi</b>' }),
    })
    expect(renderToStaticMarkup(page)).not.toContain('data-testid="hold-refusal"')
  })

  it('emits data-testid="seeker-space-closed" only once when closed and a unit is selected', async () => {
    mockSpace = {
      ...mockSpace!,
      opens_at: '01:00:00',
      closes_at: '02:00:00',
    }
    const page = await SpaceProfilePage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({ unit: 'u1' }),
    })
    const html = renderToStaticMarkup(page)

    const closedMatches = [...html.matchAll(/data-testid="seeker-space-closed"/g)]
    expect(closedMatches).toHaveLength(1)
    expect(html).toContain('data-testid="selected-unit-space-closed"')
  })

  describe('generateMetadata', () => {
    it('returns Space Not Found for malformed UUID', async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ spaceId: 'bad-uuid' }),
      })
      expect(meta).toEqual({ title: 'Space Not Found' })
    })

    it('returns Space Not Found for pending space', async () => {
      mockSpace = {
        ...mockSpace!,
        status: 'pending',
      }
      const meta = await generateMetadata({
        params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      })
      expect(meta).toEqual({ title: 'Space Not Found' })
    })

    it('returns space name for verified space', async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      })
      expect(meta).toEqual({ title: 'Kapihan Study Hall' })
    })
  })
})
