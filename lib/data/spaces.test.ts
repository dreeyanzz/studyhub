import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  getManilaMinutesFromDate,
  isSpaceOpen24h,
  isSpaceOpenLate,
  isSpaceOpenNow,
  parseTimeToMinutes,
  searchVerifiedSpaces,
} from './spaces'
import type { Database } from '@/lib/supabase/database.types'

describe('searchVerifiedSpaces and hours logic (STORY-08, FR-1.1, FR-1.2, D-048, D-055)', () => {
  describe('Operating hours pure helper functions (Asia/Manila, D-048)', () => {
    it('parses time strings to minutes from midnight', () => {
      expect(parseTimeToMinutes('00:00')).toBe(0)
      expect(parseTimeToMinutes('07:30')).toBe(450)
      expect(parseTimeToMinutes('22:00')).toBe(1320)
      expect(parseTimeToMinutes('23:59')).toBe(1439)
    })

    it('calculates current Manila time in minutes from UTC correctly', () => {
      // 14:00 UTC = 22:00 Manila (UTC+8) -> 1320 minutes
      const d1 = new Date('2026-11-08T14:00:00Z')
      expect(getManilaMinutesFromDate(d1)).toBe(1320)

      // 00:00 UTC = 08:00 Manila -> 480 minutes
      const d2 = new Date('2026-11-08T00:00:00Z')
      expect(getManilaMinutesFromDate(d2)).toBe(480)

      // 16:30 UTC = 00:30 next day Manila -> 30 minutes
      const d3 = new Date('2026-11-08T16:30:00Z')
      expect(getManilaMinutesFromDate(d3)).toBe(30)
    })

    it('evaluates isSpaceOpenNow for same-day hours (e.g. 08:00 - 22:00)', () => {
      const opens = '08:00'
      const closes = '22:00'

      expect(isSpaceOpenNow(opens, closes, 479)).toBe(false) // 07:59
      expect(isSpaceOpenNow(opens, closes, 480)).toBe(true) // 08:00
      expect(isSpaceOpenNow(opens, closes, 800)).toBe(true) // 13:20
      expect(isSpaceOpenNow(opens, closes, 1319)).toBe(true) // 21:59
      expect(isSpaceOpenNow(opens, closes, 1320)).toBe(false) // 22:00
      expect(isSpaceOpenNow(opens, closes, 1400)).toBe(false) // 23:20
    })

    it('evaluates isSpaceOpenNow for overnight hours (e.g. 18:00 - 04:00)', () => {
      const opens = '18:00'
      const closes = '04:00'

      expect(isSpaceOpenNow(opens, closes, 1079)).toBe(false) // 17:59
      expect(isSpaceOpenNow(opens, closes, 1080)).toBe(true) // 18:00
      expect(isSpaceOpenNow(opens, closes, 1439)).toBe(true) // 23:59
      expect(isSpaceOpenNow(opens, closes, 0)).toBe(true) // 00:00
      expect(isSpaceOpenNow(opens, closes, 239)).toBe(true) // 03:59
      expect(isSpaceOpenNow(opens, closes, 240)).toBe(false) // 04:00
      expect(isSpaceOpenNow(opens, closes, 720)).toBe(false) // 12:00
    })

    it('evaluates isSpaceOpenNow for 24-hour spaces (opens_at = closes_at, D-027)', () => {
      expect(isSpaceOpenNow('00:00', '00:00', 0)).toBe(true)
      expect(isSpaceOpenNow('00:00', '00:00', 720)).toBe(true)
      expect(isSpaceOpenNow('08:00', '08:00', 300)).toBe(true)
    })

    it('evaluates isSpaceOpenLate (closes >= 22:00, overnight, or 24h)', () => {
      // Closes at or after 22:00
      expect(isSpaceOpenLate('08:00', '22:00')).toBe(true)
      expect(isSpaceOpenLate('08:00', '23:30')).toBe(true)
      expect(isSpaceOpenLate('08:00', '21:59')).toBe(false)
      expect(isSpaceOpenLate('09:00', '18:00')).toBe(false)

      // Overnight closing past midnight
      expect(isSpaceOpenLate('18:00', '02:00')).toBe(true)
      expect(isSpaceOpenLate('16:00', '00:00')).toBe(true)

      // 24 Hours
      expect(isSpaceOpenLate('00:00', '00:00')).toBe(true)
    })

    it('evaluates isSpaceOpen24h (opens_at = closes_at, D-027)', () => {
      expect(isSpaceOpen24h('00:00', '00:00')).toBe(true)
      expect(isSpaceOpen24h('08:00', '08:00')).toBe(true)
      expect(isSpaceOpen24h('08:00', '22:00')).toBe(false)
    })
  })

  describe('searchVerifiedSpaces query helper', () => {
    const space1 = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Talamban Study Haven',
      description: 'Quiet tables near USC TC',
      address: 'Nasipit, Talamban, Cebu City',
      opens_at: '07:00:00',
      closes_at: '23:00:00',
      latitude: 10.355,
      longitude: 123.912,
      price_tier: 'budget' as const,
      status: 'verified',
      space_curated_tags: [
        {
          tag_id: 'wifi_fast',
          curated_tags: {
            id: 'wifi_fast',
            label: 'Wi-Fi: Fast (50+ Mbps)',
            category: 'wifi',
          },
        },
        {
          tag_id: 'outlets_all',
          curated_tags: {
            id: 'outlets_all',
            label: 'Outlets: Every Seat',
            category: 'power',
          },
        },
      ],
      space_custom_tags: [{ id: 'ct-1', name: 'Coffee available' }],
    }

    const space2 = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Downtown Focus Lounge',
      description: 'Central study space near Colon',
      address: 'P. del Rosario, Cebu City',
      opens_at: '08:00:00',
      closes_at: '20:00:00',
      latitude: 10.301,
      longitude: 123.898,
      price_tier: 'free' as const,
      status: 'verified',
      space_curated_tags: [
        {
          tag_id: 'wifi_fast',
          curated_tags: {
            id: 'wifi_fast',
            label: 'Wi-Fi: Fast (50+ Mbps)',
            category: 'wifi',
          },
        },
      ],
      space_custom_tags: [],
    }

    function createMockSpacesChain(
      data: unknown,
      error: Error | null = null,
      callbacks?: {
        onEq?: (col: string, val: unknown) => void
        onIn?: (col: string, vals: unknown[]) => void
        onOr?: (cond: string) => void
      },
    ) {
      const chain = {
        eq: vi.fn().mockImplementation((col: string, val: unknown) => {
          callbacks?.onEq?.(col, val)
          return chain
        }),
        in: vi.fn().mockImplementation((col: string, vals: unknown[]) => {
          callbacks?.onIn?.(col, vals)
          return chain
        }),
        or: vi.fn().mockImplementation((cond: string) => {
          callbacks?.onOr?.(cond)
          return chain
        }),
        then: vi
          .fn()
          .mockImplementation(
            (resolve: (val: { data: unknown; error: unknown }) => void) =>
              resolve({ data, error }),
          ),
      }
      return chain
    }

    it('enforces status = verified invariant (D-055)', async () => {
      let statusFilter = ''

      const mockQueryBuilder = createMockSpacesChain([space1], null, {
        onEq: (col, val) => {
          if (col === 'status') statusFilter = val as string
        },
      })

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockQueryBuilder),
        }),
      } as unknown as SupabaseClient<Database>

      const results = await searchVerifiedSpaces(mockSupabase, {})

      expect(mockSupabase.from).toHaveBeenCalledWith('spaces')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'verified')
      expect(statusFilter).toBe('verified')
      expect(results).toHaveLength(1)
      expect(results[0]?.name).toBe('Talamban Study Haven')
    })

    it('applies strict AND logic for multiple curated tags', async () => {
      // Requesting both 'wifi_fast' AND 'outlets_all'
      // space1 has both; space2 only has 'wifi_fast'
      const tagRows = [
        { space_id: space1.id, tag_id: 'wifi_fast' },
        { space_id: space1.id, tag_id: 'outlets_all' },
        { space_id: space2.id, tag_id: 'wifi_fast' },
      ]

      let inFilterIds: string[] = []

      const mockSpacesChain = createMockSpacesChain([space1], null, {
        onIn: (col, vals) => {
          if (col === 'id') inFilterIds = vals as string[]
        },
      })

      const mockTagsChain = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: tagRows, error: null }),
        }),
      }

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'space_curated_tags') return mockTagsChain
          if (table === 'spaces')
            return {
              select: vi.fn().mockReturnValue(mockSpacesChain),
            }
          throw new Error(`Unexpected table ${table}`)
        }),
      } as unknown as SupabaseClient<Database>

      const results = await searchVerifiedSpaces(mockSupabase, {
        tags: ['wifi_fast', 'outlets_all'],
      })

      // Only space1 had both tags
      expect(inFilterIds).toEqual([space1.id])
      expect(results).toHaveLength(1)
      expect(results[0]?.id).toBe(space1.id)
    })

    it('returns empty array immediately if no spaces match all requested curated tags', async () => {
      const mockTagsChain = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            // Only 1 tag matched for space1, but 2 were requested
            data: [{ space_id: space1.id, tag_id: 'wifi_fast' }],
            error: null,
          }),
        }),
      }

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'space_curated_tags') return mockTagsChain
          throw new Error('Should not query spaces if tags did not match')
        }),
      } as unknown as SupabaseClient<Database>

      const results = await searchVerifiedSpaces(mockSupabase, {
        tags: ['wifi_fast', 'outlets_all'],
      })

      expect(results).toEqual([])
    })

    it('filters by unit type inventory via units table', async () => {
      const unitRows = [{ space_id: space1.id }]
      let inFilterIds: string[] = []

      const mockUnitsChain = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: unitRows, error: null }),
        }),
      }

      const mockSpacesChain = createMockSpacesChain([space1], null, {
        onIn: (col, vals) => {
          if (col === 'id') inFilterIds = vals as string[]
        },
      })

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'units') return mockUnitsChain
          if (table === 'spaces')
            return {
              select: vi.fn().mockReturnValue(mockSpacesChain),
            }
          throw new Error(`Unexpected table ${table}`)
        }),
      } as unknown as SupabaseClient<Database>

      const results = await searchVerifiedSpaces(mockSupabase, {
        unitType: ['room'],
      })

      expect(inFilterIds).toEqual([space1.id])
      expect(results).toHaveLength(1)
    })

    it('filters by price tier directly against spaces table', async () => {
      let priceFilterTiers: string[] = []

      const mockSpacesChain = createMockSpacesChain([space1], null, {
        onIn: (col, vals) => {
          if (col === 'price_tier') priceFilterTiers = vals as string[]
        },
      })

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockSpacesChain),
        }),
      } as unknown as SupabaseClient<Database>

      await searchVerifiedSpaces(mockSupabase, {
        price: ['budget'],
      })

      expect(priceFilterTiers).toEqual(['budget'])
    })

    it('evaluates dynamic hours filter open_now at specified Manila reference time', async () => {
      const mockSpacesChain = createMockSpacesChain([space1, space2])

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockSpacesChain),
        }),
      } as unknown as SupabaseClient<Database>

      // At 21:00 Manila time (13:00 UTC):
      // space1 (closes 23:00) is OPEN
      // space2 (closes 20:00) is CLOSED
      const eveningManila = new Date('2026-11-08T13:00:00Z')

      const results = await searchVerifiedSpaces(
        mockSupabase,
        { hours: ['open_now'] },
        { now: eveningManila },
      )

      expect(results).toHaveLength(1)
      expect(results[0]?.id).toBe(space1.id)
    })

    it('evaluates dynamic hours filter open_late', async () => {
      const mockSpacesChain = createMockSpacesChain([space1, space2])

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockSpacesChain),
        }),
      } as unknown as SupabaseClient<Database>

      // space1 closes at 23:00 (Open Late: true)
      // space2 closes at 20:00 (Open Late: false)
      const results = await searchVerifiedSpaces(mockSupabase, {
        hours: ['open_late'],
      })

      expect(results).toHaveLength(1)
      expect(results[0]?.id).toBe(space1.id)
    })

    it('resolves campus search "USC Talamban" and computes distance within radius', async () => {
      const mockSpacesChain = createMockSpacesChain([space1, space2])

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockSpacesChain),
        }),
      } as unknown as SupabaseClient<Database>

      // Searching for "USC Talamban":
      // space1 is ~0.1 km away from USC TC (10.354, 123.9114)
      // space2 is in Downtown Colon (~6 km away), exceeding 3 km campus radius
      const results = await searchVerifiedSpaces(mockSupabase, {
        q: 'USC Talamban',
      })

      expect(results).toHaveLength(1)
      expect(results[0]?.id).toBe(space1.id)
      expect(results[0]?.distance_km).not.toBeNull()
      expect(results[0]?.distance_km).toBeLessThan(1.0)
    })

    it('falls back to text ilike search on name and address for non-campus query', async () => {
      let orFilter = ''

      const mockSpacesChain = createMockSpacesChain([space1], null, {
        onOr: (cond) => {
          orFilter = cond
        },
      })

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockSpacesChain),
        }),
      } as unknown as SupabaseClient<Database>

      await searchVerifiedSpaces(mockSupabase, {
        q: 'Nasipit',
      })

      expect(orFilter).toContain('Nasipit')
      expect(orFilter).toContain('name.ilike')
      expect(orFilter).toContain('address.ilike')
    })

    it('returns empty array when database returns an error', async () => {
      const mockSpacesChain = createMockSpacesChain(null, new Error('Postgres error'))

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockSpacesChain),
        }),
      } as unknown as SupabaseClient<Database>

      const results = await searchVerifiedSpaces(mockSupabase, {})
      expect(results).toEqual([])
    })
  })
})
