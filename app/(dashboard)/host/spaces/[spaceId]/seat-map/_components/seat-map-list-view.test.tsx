import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  notFound: vi.fn(),
  redirect: vi.fn(),
}))

import type { SeatMapZone } from '@/lib/seat-map/grid'
import { SeatMapListView } from './seat-map-list-view'

describe('SeatMapListView (STORY-07 TSK-07.7)', () => {
  const spaceId = '11111111-1111-4111-8111-111111111111'
  const baseHref = `/host/spaces/${spaceId}/seat-map`

  const seat = (
    id: string,
    label: string,
    row: number,
    col: number,
    seatState: 'available' | 'reserved' | 'occupied' = 'available',
  ) => ({
    id,
    unitType: 'seat' as const,
    label,
    capacity: null,
    row,
    col,
    colSpan: 1,
    seatState,
    hostUpdatedAt: '2026-11-01T00:00:00Z',
    waitWindowEndsAt: null,
    reservationId: null,
  })

  const room = (
    id: string,
    label: string,
    capacity: number,
    row: number,
    col: number,
    colSpan: number,
  ) => ({
    id,
    unitType: 'room' as const,
    label,
    capacity,
    row,
    col,
    colSpan,
    seatState: 'available' as const,
    hostUpdatedAt: '2026-11-01T00:00:00Z',
    waitWindowEndsAt: null,
    reservationId: null,
  })

  const zones: SeatMapZone[] = [
    {
      id: 'zone-1',
      name: 'Quiet desks',
      units: [
        seat('u1', 'S1', 0, 0),
        seat('u2', 'S2', 0, 1, 'reserved'),
        room('u3', 'Room A', 6, 1, 0, 3),
      ],
    },
    {
      id: 'zone-2',
      name: 'Standing area',
      units: [],
    },
  ]

  it('renders a friendly prompt and an add zone form when space has no zones', () => {
    const html = renderToStaticMarkup(
      <SeatMapListView spaceId={spaceId} zones={[]} confirm={null} baseHref={baseHref} />,
    )

    expect(html).toContain('This Space has no zones yet')
    expect(html).toContain('Quiet desks')
    expect(html).toContain('Add zone')
  })

  it('renders zones and units in an accessible semantic structure', () => {
    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={null}
        baseHref={baseHref}
      />,
    )

    // Zone headings with programmatic focusability
    expect(html).toContain('id="zone-heading-zone-1"')
    expect(html).toContain('id="zone-heading-zone-2"')
    expect(html).toContain('Quiet desks')
    expect(html).toContain('(3 units)')
    expect(html).toContain('Standing area')
    expect(html).toContain('(0 units)')

    // Unit cards with headings and descriptions
    expect(html).toContain('id="unit-u1"')
    expect(html).toContain('id="unit-heading-u1"')
    expect(html).toContain('S1')
    expect(html).toContain('Row 1, Column 1')
    expect(html).toContain('State: Available')

    expect(html).toContain('S2')
    expect(html).toContain('Row 1, Column 2')
    expect(html).toContain('State: Reserved')

    expect(html).toContain('Room A')
    expect(html).toContain('Capacity: 6 people')
    expect(html).toContain('Row 2, Columns 1 to 3')
    expect(html).toContain('3 cells wide')
  })

  it('renders an aria-live polite region for screen reader announcements', () => {
    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={null}
        baseHref={baseHref}
      />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
  })

  it('provides Move up and Move down forms with proper disabled states', () => {
    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={null}
        baseHref={baseHref}
      />,
    )

    // First zone: Move up has disabled attribute, Move down does not
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Move Quiet desks up"/)
    expect(html).not.toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Move Quiet desks down"/,
    )

    // Last zone: Move down has disabled attribute, Move up does not
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Move Standing area down"/,
    )
    expect(html).not.toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Move Standing area up"/,
    )
  })

  it('provides Rename and Delete links/forms for each zone', () => {
    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={null}
        baseHref={baseHref}
      />,
    )

    expect(html).toContain('Rename<span class="sr-only"> Quiet desks</span>')
    expect(html).toContain(`href="${baseHref}?view=list&amp;delete-zone=zone-1#confirm"`)
  })

  it('shows an empty zone prompt when a zone has no units', () => {
    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={null}
        baseHref={baseHref}
      />,
    )

    expect(html).toContain('This zone has no units. Use the form below to add one.')
  })

  it('renders edit form with native row and column selects', () => {
    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={null}
        baseHref={baseHref}
      />,
    )

    // S1 edit form
    expect(html).toContain('Edit<span class="sr-only"> S1</span>')
    expect(html).toContain('Row 1')
    expect(html).toContain('Row 50')
    expect(html).toContain('Column 1')
    expect(html).toContain('Column 6')
  })

  it('renders add unit form defaulting to the first free cell in that zone', () => {
    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={null}
        baseHref={baseHref}
      />,
    )

    expect(html).toContain('Add a unit to Quiet desks')
    expect(html).toContain('Add a unit to Standing area')
  })

  it('renders confirmation panel in place when removing a unit', () => {
    const confirm = {
      kind: 'unit' as const,
      id: 'u2',
      label: 'S2',
      zoneId: 'zone-1',
      zoneName: 'Quiet desks',
    }

    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={confirm}
        baseHref={baseHref}
      />,
    )

    // In place of S2 unit card, #confirm panel renders
    expect(html).toContain('id="confirm"')
    expect(html).toContain('Remove S2?')
    expect(html).toContain('This removes S2 from Quiet desks. It can&#x27;t be undone.')
    expect(html).toContain(`href="${baseHref}?view=list"`)
    // S1 still renders normally
    expect(html).toContain('id="unit-u1"')
  })

  it('renders confirmation panel in place when deleting a zone', () => {
    const confirm = {
      kind: 'zone' as const,
      id: 'zone-1',
      name: 'Quiet desks',
      unitCount: 3,
    }

    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={confirm}
        baseHref={baseHref}
      />,
    )

    // In place of zone-1 section, #confirm panel renders
    expect(html).toContain('id="confirm"')
    expect(html).toContain('Delete Quiet desks and its 3 units?')
    expect(html).toContain(`href="${baseHref}?view=list"`)
    // Zone 2 still renders normally
    expect(html).toContain('id="zone-heading-zone-2"')
  })

  it('ends the page with an Add a zone form', () => {
    const html = renderToStaticMarkup(
      <SeatMapListView
        spaceId={spaceId}
        zones={zones}
        confirm={null}
        baseHref={baseHref}
      />,
    )

    expect(html).toContain('id="add-zone-heading"')
    expect(html).toContain('Add a zone')
    expect(html).toContain('New zone name')
  })

  describe('buildViewHref and findRemovalTarget (TSK-07.7)', () => {
    it('switches between grid and list while preserving existing query params', async () => {
      const { buildViewHref } = await import('../page')

      expect(buildViewHref(baseHref, {}, 'grid')).toBe(baseHref)
      expect(buildViewHref(baseHref, {}, 'list')).toBe(`${baseHref}?view=list`)
      expect(buildViewHref(baseHref, { view: 'list' }, 'grid')).toBe(baseHref)
      expect(buildViewHref(baseHref, { view: 'list' }, 'list')).toBe(
        `${baseHref}?view=list`,
      )

      // Preserves remove param across toggles
      expect(buildViewHref(baseHref, { remove: 'u1' }, 'list')).toBe(
        `${baseHref}?remove=u1&view=list`,
      )
      expect(buildViewHref(baseHref, { view: 'list', remove: 'u1' }, 'grid')).toBe(
        `${baseHref}?remove=u1`,
      )
    })

    it('identifies removal target for units and zones and ignores unknown ids', async () => {
      const { findRemovalTarget } = await import('../page')

      // Unit target
      const unitTarget = findRemovalTarget(zones, { remove: 'u1' })
      expect(unitTarget).toEqual({
        kind: 'unit',
        id: 'u1',
        label: 'S1',
        zoneId: 'zone-1',
        zoneName: 'Quiet desks',
      })

      // Zone target
      const zoneTarget = findRemovalTarget(zones, { 'delete-zone': 'zone-1' })
      expect(zoneTarget).toEqual({
        kind: 'zone',
        id: 'zone-1',
        name: 'Quiet desks',
        unitCount: 3,
      })

      // Unknown id returns null
      expect(findRemovalTarget(zones, { remove: 'unknown-id' })).toBeNull()
      expect(findRemovalTarget(zones, { 'delete-zone': 'unknown-id' })).toBeNull()
      expect(findRemovalTarget(zones, {})).toBeNull()

      // Array query parameters defensively take the first string
      expect(findRemovalTarget(zones, { remove: ['u1', 'u2'] })).toEqual({
        kind: 'unit',
        id: 'u1',
        label: 'S1',
        zoneId: 'zone-1',
        zoneName: 'Quiet desks',
      })
      expect(findRemovalTarget(zones, { 'delete-zone': ['zone-1', 'zone-2'] })).toEqual({
        kind: 'zone',
        id: 'zone-1',
        name: 'Quiet desks',
        unitCount: 3,
      })
    })
  })
})
