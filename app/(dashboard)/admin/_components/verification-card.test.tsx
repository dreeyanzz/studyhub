import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { VerificationCard, type VerificationCardItem } from './verification-card'

const space: VerificationCardItem = {
  id: 'e0000000-0000-4000-8000-000000000001',
  name: 'Kapihan Study Hub',
  description: null,
  address: '123 Cebu Tech Park, Cebu City',
  opens_at: '08:00:00',
  closes_at: '22:00:00',
  status: 'pending',
  created_at: '2026-11-01T08:00:00Z',
  updated_at: '2026-11-01T08:00:00Z',
  host_name: 'Hugo Santos',
}

const render = (item: VerificationCardItem, onInspect?: () => void) =>
  renderToStaticMarkup(
    <VerificationCard space={item} onDecision={async () => {}} onInspect={onInspect} />,
  )

describe('VerificationCard (STORY-15 design §3, STORY-17)', () => {
  it('labels the Host once: the <dt> says "Host:" and the value is the name alone', () => {
    const html = render(space)

    expect(html).toMatch(/>Host: <\/dt><dd[^>]*>Hugo Santos<\/dd>/)
    expect(html).not.toContain('Host: Host:')
  })

  it('falls back to "Unnamed" when the Host has no name', () => {
    for (const host_name of [null, '', '   ']) {
      const html = render({ ...space, host_name })

      expect(html).toMatch(/>Host: <\/dt><dd[^>]*>Unnamed<\/dd>/)
    }
  })

  it('renders an accessible Inspect button when onInspect is provided', () => {
    const html = render(space, () => {})

    expect(html).toContain('Inspect')
    expect(html).toContain('<span class="sr-only"> Kapihan Study Hub</span>')
  })
})
