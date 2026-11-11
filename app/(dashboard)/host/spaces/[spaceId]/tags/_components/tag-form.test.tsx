import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The form only needs the action's identity; the action has its own tests.
vi.mock('../actions', () => ({ saveSpaceTagsAction: vi.fn(async () => ({})) }))

import { TagForm, type CuratedTagOption } from './tag-form'

const spaceId = 'e0000000-0000-4000-8000-000000000001'

const catalog: CuratedTagOption[] = [
  {
    id: 'wifi_basic',
    category: 'wifi',
    label: 'Wi-Fi: Standard (10+ Mbps)',
    description: null,
  },
  {
    id: 'wifi_fast',
    category: 'wifi',
    label: 'Wi-Fi: Fast (50+ Mbps)',
    description: 'High-speed internet suitable for video calls',
  },
  {
    id: 'outlets_all',
    category: 'power',
    label: 'Outlets: Every Seat',
    description: null,
  },
  {
    id: 'noise_quiet',
    category: 'noise',
    label: 'Noise: Quiet Focus',
    description: null,
  },
  { id: 'ac_full', category: 'ac', label: 'Air Conditioning', description: null },
]

function render(curated: string[] = [], custom: string[] = []) {
  return renderToStaticMarkup(
    <TagForm
      spaceId={spaceId}
      catalog={catalog}
      initialCuratedTagIds={curated}
      initialCustomTagNames={custom}
    />,
  )
}

describe('TagForm (STORY-08, TSK-08.5)', () => {
  it('groups curated tags under the four category legends', () => {
    const html = render()

    for (const heading of ['Wi-Fi', 'Power outlets', 'Noise level', 'Air conditioning']) {
      expect(html).toContain(
        `<legend class="px-1 text-sm font-medium">${heading}</legend>`,
      )
    }
    expect(html.match(/name="curatedTagIds"/g)).toHaveLength(catalog.length)
    expect(html).toContain('High-speed internet suitable for video calls')
  })

  it('ticks only the Space’s saved curated tags', () => {
    const html = render(['wifi_fast', 'ac_full'])

    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="wifi_fast"/)
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="ac_full"/)
    expect(html).not.toMatch(/<input[^>]*checked=""[^>]*value="wifi_basic"/)
  })

  it('shows saved custom tags as pills, each with a hidden field and a named remove button', () => {
    const html = render([], ['Pet friendly', 'Rooftop'])

    expect(html).toContain(
      '<input type="hidden" name="customTagNames" value="Pet friendly"/>',
    )
    expect(html).toContain('<input type="hidden" name="customTagNames" value="Rooftop"/>')
    expect(html).toContain('aria-label="Remove tag Pet friendly"')
    expect(html).not.toContain('No custom tags yet.')
  })

  it('says custom tags never power search filters (D-006, FR-1.3)', () => {
    const html = render()

    expect(html).toContain(
      'Custom tags are displayed on your space profile for context, but do not power seeker search filters.',
    )
    expect(html).toContain('No custom tags yet.')
  })

  it('carries the Space id and a Save tags button', () => {
    const html = render()

    expect(html).toContain(`<input type="hidden" name="spaceId" value="${spaceId}"/>`)
    expect(html).toContain('Save tags')
    expect(html).toContain('Discard changes')
  })

  it('escapes a stored custom tag, so it can never run as HTML', () => {
    // The database refuses < and > (STORY-08 design §2); this checks React's escaping
    // stays the second line of defence.
    const html = render([], ['Tom & Jerry'])

    expect(html).toContain('Tom &amp; Jerry')
  })
})
