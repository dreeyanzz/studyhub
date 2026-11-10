import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  status: 'verified' | 'pending' | 'rejected'
}

let mockSpace: MockSpaceData | null = null
let mockZones: SeatMapZone[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
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
  })),
}))

vi.mock('@/lib/data/seat-map', () => ({
  getSeatMap: vi.fn(async () => mockZones),
}))

describe('SpaceProfilePage (STORY-11, TSK-11.3)', () => {
  beforeEach(() => {
    mockNotFound.mockClear()
    mockSpace = {
      id: VALID_SPACE_ID,
      name: 'Kapihan Study Hall',
      description: 'A quiet study haven with premium coffee.',
      address: '123 Colon Street, Cebu City',
      opens_at: '00:00:00',
      closes_at: '00:00:00', // Open 24 hours so it's open by default
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
    expect(html).toContain('Open 24 hours')
    // No closed or empty notice
    expect(html).not.toContain('This Space is closed now')
    expect(html).not.toContain('No units are currently Available')
  })

  it('renders closed notice with link to search when space is closed (seeker-space-closed)', async () => {
    // 01:00 to 02:00 is almost certainly closed during standard daytime / normal hours
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
    expect(html).toContain('Explore other spaces')
    expect(html).toContain('data-testid="seeker-space-closed"')
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
