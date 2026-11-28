import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  DiscoveryShell,
  buildDiscoveryQueryString,
  filterSpacesClientSide,
  nextMapFocus,
  normalizeDiscoveryQuery,
  parseDiscoverySearchParams,
  resolveDiscoveryMapCenter,
  sortSpacesClientSide,
} from './discovery-shell'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'

describe('DiscoveryShell component and filter helpers (STORY-08, FR-1.1, FR-1.2, D-003, D-012)', () => {
  const mockSpaces: VerifiedSpaceSearchResult[] = [
    {
      id: 'space-1',
      name: 'Talamban Study Haven',
      description: 'Tables near USC TC',
      address: 'Talamban, Cebu City',
      opens_at: '08:00:00',
      closes_at: '23:00:00',
      latitude: 10.354,
      longitude: 123.9114,
      price_tier: 'budget',
      distance_km: 0.5,
      curated_tags: [
        { id: 'wifi_fast', label: 'Wi-Fi: Fast (50+ Mbps)', category: 'wifi' },
        { id: 'outlets_all', label: 'Outlets: Every Seat', category: 'power' },
      ],
      custom_tags: ['beanbags'],
      unit_types: ['seat', 'room'],
      review_count: 2,
      avg_overall: 4.25,
    },
    {
      id: 'space-2',
      name: 'IT Park 24/7 Pod',
      description: 'Round-the-clock study pods',
      address: 'Cebu IT Park, Lahug, Cebu City',
      opens_at: '00:00:00',
      closes_at: '00:00:00',
      latitude: 10.3302,
      longitude: 123.9064,
      price_tier: 'premium',
      distance_km: 2.1,
      curated_tags: [
        { id: 'wifi_fast', label: 'Wi-Fi: Fast (50+ Mbps)', category: 'wifi' },
        { id: 'ac_full', label: 'Air Conditioning', category: 'ac' },
      ],
      custom_tags: ['free-coffee'],
      unit_types: ['standing_desk'],
      review_count: 0,
      avg_overall: null,
    },
  ]

  it('renders search bar, desktop filter panel, mobile filter drawer, and split-screen list/map', () => {
    const html = renderToStaticMarkup(<DiscoveryShell spaces={mockSpaces} />)

    expect(html).toContain('discovery-shell')
    expect(html).toContain('discovery-search-bar')
    expect(html).toContain('filter-panel')
    expect(html).toContain('filter-drawer-trigger')
    expect(html).toContain('aria-label="Study spaces list"')
    expect(html).toContain('aria-label="Discovery map"')
    expect(html).toContain('Talamban Study Haven')
    expect(html).toContain('IT Park 24/7 Pod')
  })

  it('renders floating mobile view toggle button with 48px touch target (D-031)', () => {
    const html = renderToStaticMarkup(<DiscoveryShell spaces={mockSpaces} />)

    expect(html).toContain('mobile-view-toggle')
    expect(html).toContain('Map view')
    expect(html).toContain('min-h-12 min-w-12')
  })

  it('combines multi-criteria curated filters with strict AND logic', () => {
    // Both spaces have wifi_fast, but only space-1 ALSO has outlets_all
    const bothTagsQuery = normalizeDiscoveryQuery({
      tags: ['wifi_fast', 'outlets_all'],
    })
    const filteredBoth = filterSpacesClientSide(mockSpaces, bothTagsQuery)
    expect(filteredBoth).toHaveLength(1)
    expect(filteredBoth[0]?.id).toBe('space-1')

    // Clearing outlets_all immediately restores space-2 as well
    const singleTagQuery = normalizeDiscoveryQuery({
      tags: ['wifi_fast'],
    })
    const restored = filterSpacesClientSide(mockSpaces, singleTagQuery)
    expect(restored).toHaveLength(2)
  })

  it('filters by price tier, dynamic operating hours (Asia/Manila), and campus/text search', () => {
    // 14:00 UTC = 22:00 Asia/Manila (space-1 closes at 23:00, space-2 is 24h)
    const nowManila2200 = new Date('2026-11-11T14:00:00Z')

    const open24hAndPremium = filterSpacesClientSide(
      mockSpaces,
      normalizeDiscoveryQuery({
        price: ['premium'],
        hours: ['open_24h', 'open_now'],
      }),
      nowManila2200,
    )
    expect(open24hAndPremium).toHaveLength(1)
    expect(open24hAndPremium[0]?.id).toBe('space-2')

    // Campus search for "USC TC" centers on Talamban (within 3km radius) and sorts by distance
    const uscSearch = filterSpacesClientSide(
      mockSpaces,
      normalizeDiscoveryQuery({ q: 'USC TC' }),
      nowManila2200,
    )
    expect(uscSearch[0]?.id).toBe('space-1')
    expect(uscSearch[0]?.distance_km).toBe(0)
  })

  it('builds URL query string and resolves map center for campus or user coordinates', () => {
    const query = normalizeDiscoveryQuery({
      q: 'CIT-U',
      tags: ['wifi_fast', 'outlets_all'],
      price: ['budget'],
      hours: ['open_now'],
      unitType: ['seat'],
    })

    const qs = buildDiscoveryQueryString(query)
    expect(qs).toContain('q=CIT-U')
    expect(qs).toContain('tags=wifi_fast')
    expect(qs).toContain('tags=outlets_all')
    expect(qs).toContain('price=budget')
    expect(qs).toContain('hours=open_now')
    expect(qs).toContain('unitType=seat')

    const campusCenter = resolveDiscoveryMapCenter(query)
    expect(campusCenter.center).toEqual([10.2941, 123.8797])
    expect(campusCenter.zoom).toBe(15)

    const gpsCenter = resolveDiscoveryMapCenter(
      normalizeDiscoveryQuery({ lat: 10.32, lng: 123.9 }),
    )
    expect(gpsCenter.center).toEqual([10.32, 123.9])
    expect(gpsCenter.zoom).toBe(15)
  })

  it('renders an accessible 48px sort control and sorts by open_now, rating, and nearest (STORY-17)', () => {
    const html = renderToStaticMarkup(<DiscoveryShell spaces={mockSpaces} />)
    expect(html).toContain('data-testid="discovery-sort"')
    expect(html).toContain('min-h-12')
    expect(html).toContain('Open now first')
    expect(html).toContain('Highest rated')
    expect(html).toContain('Nearest')

    // 15:30 UTC = 23:30 Asia/Manila (space-1 closes at 23:00, space-2 is 24h)
    const nowManila2330 = new Date('2026-11-11T15:30:00Z')
    const openFirst = sortSpacesClientSide(mockSpaces, 'open_now', nowManila2330)
    expect(openFirst.map((s) => s.id)).toEqual(['space-2', 'space-1'])

    const byRating = sortSpacesClientSide(
      [mockSpaces[1]!, mockSpaces[0]!],
      'rating',
      nowManila2330,
    )
    expect(byRating.map((s) => s.id)).toEqual(['space-1', 'space-2'])

    const byNearest = sortSpacesClientSide(
      [mockSpaces[1]!, mockSpaces[0]!],
      'nearest',
      nowManila2330,
    )
    expect(byNearest.map((s) => s.id)).toEqual(['space-1', 'space-2'])
  })

  it('filters by unitType client-side and parses repeated URLSearchParams', () => {
    const roomsOnly = filterSpacesClientSide(
      mockSpaces,
      normalizeDiscoveryQuery({ unitType: ['room'] }),
    )
    expect(roomsOnly.map((s) => s.id)).toEqual(['space-1'])

    const standingOrRoom = filterSpacesClientSide(
      mockSpaces,
      normalizeDiscoveryQuery({ unitType: ['standing_desk', 'room'] }),
    )
    expect(standingOrRoom.map((s) => s.id)).toEqual(['space-1', 'space-2'])

    const parsed = parseDiscoverySearchParams(
      new URLSearchParams(
        'q=Kapihan&tags=wifi_fast&tags=ac_full&price=budget&hours=open_now&unitType=room',
      ),
    )
    expect(parsed).toEqual({
      q: 'Kapihan',
      lat: undefined,
      lng: undefined,
      radiusKm: 10,
      tags: ['wifi_fast', 'ac_full'],
      price: ['budget'],
      hours: ['open_now'],
      unitType: ['room'],
    })
  })
})

describe('nextMapFocus (card click centres the map, FR-1.1)', () => {
  it('starts at seq 1 and gives every click, even on the same card, a new seq', () => {
    const first = nextMapFocus(null, 'a')
    expect(first).toEqual({ spaceId: 'a', seq: 1 })
    expect(nextMapFocus(first, 'a')).toEqual({ spaceId: 'a', seq: 2 })
    expect(nextMapFocus({ spaceId: 'a', seq: 2 }, 'b')).toEqual({ spaceId: 'b', seq: 3 })
  })
})
