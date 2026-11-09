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
      'href="/host/spaces/e0000000-0000-4000-8000-000000000001/edit"',
    )
    expect(html).toContain(
      'href="/host/spaces/e0000000-0000-4000-8000-000000000001/delete"',
    )
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
})
