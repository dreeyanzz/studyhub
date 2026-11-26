import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// ResubmitSpaceButton posts to this Server Action; here it is only a form target.
vi.mock('../actions', () => ({ resubmitSpaceAction: vi.fn() }))

import {
  canResubmit,
  SpaceList,
  statusBadges,
  statusReasonLabel,
  type SpaceListItem,
} from './space-list'

describe('SpaceList component (STORY-05, STORY-11 TSK-11.2)', () => {
  const mockSpaces: SpaceListItem[] = [
    {
      id: 'e0000000-0000-4000-8000-000000000001',
      name: 'Kapihan Study Hub',
      description: 'Quiet study space with fiber internet.',
      address: '123 Cebu Tech Park, Cebu City',
      opens_at: '08:00:00',
      closes_at: '22:00:00',
      status: 'verified',
      status_reason: null,
      updated_at: '2026-11-01T08:00:00Z',
    },
    {
      id: 'e0000000-0000-4000-8000-000000000002',
      name: 'Night Owls Coworking',
      description: 'Open 24 hours for nocturnal productivity.',
      address: '456 Mango Ave, Cebu City',
      opens_at: '00:00:00',
      closes_at: '00:00:00',
      status: 'pending',
      status_reason: null,
      updated_at: '2026-11-02T10:00:00Z',
    },
  ]

  it('renders a "Tags" link for each space card with accessible context (STORY-08)', () => {
    const html = renderToStaticMarkup(<SpaceList spaces={mockSpaces} canCreate={true} />)

    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000001/tags"',
    )
    expect(html).toContain('Tags<span class="sr-only"> for Kapihan Study Hub</span>')
    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000002/tags"',
    )
    expect(html).toContain('Tags<span class="sr-only"> for Night Owls Coworking</span>')
  })

  it('renders "Photos" action link for each space card with accessible context', () => {
    const html = renderToStaticMarkup(<SpaceList spaces={mockSpaces} canCreate={true} />)

    // Verify Photos link for Space 1
    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000001/photos"',
    )
    expect(html).toContain('Photos<span class="sr-only"> for Kapihan Study Hub</span>')

    // Verify Photos link for Space 2
    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000002/photos"',
    )
    expect(html).toContain('Photos<span class="sr-only"> for Night Owls Coworking</span>')

    // Verify other action links remain intact
    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000001/seat-map"',
    )
    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000001/check-in"',
    )
    expect(html).toContain(
      'Check-in desk<span class="sr-only"> for Kapihan Study Hub</span>',
    )
    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000002/check-in"',
    )
    expect(html).toContain(
      'Check-in desk<span class="sr-only"> for Night Owls Coworking</span>',
    )
    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000001/edit"',
    )
    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000001/delete"',
    )
  })

  it('renders an "Occupancy" link for each space card, after "Seat map" (STORY-12)', () => {
    const html = renderToStaticMarkup(<SpaceList spaces={mockSpaces} canCreate={true} />)

    for (const space of mockSpaces) {
      expect(html).toContain(`href="/host/spaces/${space.id}/occupancy"`)
      expect(html).toContain(`Occupancy<span class="sr-only"> for ${space.name}</span>`)
      expect(html.indexOf(`/host/spaces/${space.id}/occupancy`)).toBeGreaterThan(
        html.indexOf(`/host/spaces/${space.id}/seat-map`),
      )
    }
  })

  it('renders empty state when spaces array is empty and canCreate is true', () => {
    const html = renderToStaticMarkup(<SpaceList spaces={[]} canCreate={true} />)
    expect(html).toContain('You have no Spaces yet')
    expect(html).toContain('Use Create a Space above to add your first one.')
  })

  it('renders empty state when spaces array is empty and canCreate is false', () => {
    const html = renderToStaticMarkup(<SpaceList spaces={[]} canCreate={false} />)
    expect(html).toContain('You have no Spaces')
    expect(html).toContain('Spaces belong to the Hosts who create them.')
  })

  it('links verified Spaces to their public listing, and omits it for pending Spaces (STORY-17)', () => {
    const html = renderToStaticMarkup(<SpaceList spaces={mockSpaces} canCreate={true} />)

    expect(html).toContain('href="/spaces/e0000000-0000-4000-8000-000000000001"')
    expect(html).toContain(
      'View public listing<span class="sr-only"> for Kapihan Study Hub</span>',
    )
    expect(html).not.toContain('href="/spaces/e0000000-0000-4000-8000-000000000002"')
  })

  it('shows setup checklist items for incomplete or pending Spaces (STORY-17)', () => {
    const html = renderToStaticMarkup(
      <SpaceList
        spaces={mockSpaces}
        canCreate={true}
        setupBySpaceId={{
          'e0000000-0000-4000-8000-000000000001': {
            hasUnits: true,
            hasPhotos: true,
            hasTags: true,
          },
          'e0000000-0000-4000-8000-000000000002': {
            hasUnits: true,
            hasPhotos: false,
            hasTags: false,
          },
        }}
      />,
    )

    expect(html).toContain('Setup checklist')
    expect(html).toContain('Done')
    expect(html).toContain(
      'Add photos<span class="sr-only"> for Night Owls Coworking</span>',
    )
    expect(html).toContain(
      'Add tags<span class="sr-only"> for Night Owls Coworking</span>',
    )
  })
})

describe('Verification reasons and Resubmit on /host (STORY-20 TSK-20.2, D-084)', () => {
  const space = (overrides: Partial<SpaceListItem>): SpaceListItem => ({
    id: 'e0000000-0000-4000-8000-000000000003',
    name: 'Sulok Co-working',
    description: null,
    address: '12 Mabini St, Cebu City',
    opens_at: '08:00:00',
    closes_at: '22:00:00',
    status: 'pending',
    status_reason: null,
    updated_at: '2026-11-03T08:00:00Z',
    ...overrides,
  })
  const render = (item: SpaceListItem) =>
    renderToStaticMarkup(<SpaceList spaces={[item]} canCreate={true} />)

  it('names the reason by the status it explains', () => {
    expect(statusReasonLabel('rejected', 'Blurry photos')).toBe('Rejection reason:')
    expect(statusReasonLabel('taken_down', 'Closed for repairs')).toBe(
      'Take-down reason:',
    )
    // V8 keeps the last reason, so a resubmitted Space still shows it.
    expect(statusReasonLabel('pending', 'Blurry photos')).toBe('Previous reason:')
  })

  it('shows no reason when there is none, or the Space is Verified (N12)', () => {
    expect(statusReasonLabel('rejected', null)).toBeNull()
    expect(statusReasonLabel('taken_down', '')).toBeNull()
    // A new Space (V1) or an edited one (V6) is Pending with no reason.
    expect(statusReasonLabel('pending', null)).toBeNull()
    expect(statusReasonLabel('verified', 'stale')).toBeNull()
  })

  it('offers Resubmit for a Rejected or Taken down Space only (V8, N11)', () => {
    expect(canResubmit('rejected')).toBe(true)
    expect(canResubmit('taken_down')).toBe(true)
    expect(canResubmit('pending')).toBe(false)
    expect(canResubmit('verified')).toBe(false)
  })

  it('says "Taken down" in words, not by colour alone', () => {
    expect(statusBadges.taken_down.label).toBe('Taken down')
    expect(render(space({ status: 'taken_down', status_reason: 'x' }))).toContain(
      'Taken down',
    )
  })

  it("shows a Rejected Space's reason and a Resubmit button that names the Space", () => {
    const html = render(
      space({ status: 'rejected', status_reason: 'Photos do not match the address.' }),
    )
    expect(html).toContain('Rejection reason:')
    expect(html).toContain('Photos do not match the address.')
    expect(html).toContain('Resubmit<span class="sr-only"> Sulok Co-working</span>')
    expect(html).toContain('name="spaceId" value="e0000000-0000-4000-8000-000000000003"')
  })

  it("shows a Taken down Space's reason and a Resubmit button", () => {
    const html = render(space({ status: 'taken_down', status_reason: 'Closed.' }))
    expect(html).toContain('Take-down reason:')
    expect(html).toContain('Closed.')
    expect(html).toContain('Resubmit<span class="sr-only">')
  })

  it('shows a resubmitted Space its previous reason, with no Resubmit button', () => {
    const html = render(space({ status: 'pending', status_reason: 'Blurry photos' }))
    expect(html).toContain('Previous reason:')
    expect(html).toContain('Blurry photos')
    expect(html).not.toContain('Resubmit')
  })

  it('shows neither a reason nor Resubmit on a Verified or new Pending Space', () => {
    for (const status of ['verified', 'pending'] as const) {
      const html = render(space({ status }))
      expect(html).not.toContain('reason:')
      expect(html).not.toContain('Resubmit')
    }
  })

  it('shows the reason as text, never as HTML', () => {
    const html = render(
      space({ status: 'rejected', status_reason: '<img src=x onerror=alert(1)>' }),
    )
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<img')
  })
})
