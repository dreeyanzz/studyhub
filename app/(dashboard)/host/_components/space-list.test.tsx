import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SpaceList, type SpaceListItem } from './space-list'

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
