import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({ holdUnit: vi.fn() }))

import type { HoldTerms } from '@/lib/data/reservations'

import { HoldUnitPanel, type HoldUnitPanelProps } from './hold-unit-panel'

const spaceId = 'e0000000-0000-4000-8000-000000000002'
const terms: HoldTerms = {
  feeAmount: 5000,
  paymentWindowMinutes: 10,
  maxWaitWindowMinutes: 60,
  isOpen: true,
  nextClosingAt: '2026-11-14T14:00:00Z',
  waitWindowMinutes: [15, 30, 45, 60],
}
const base: HoldUnitPanelProps = {
  spaceId,
  unit: { id: 'f0000000-0000-4000-8000-000000000017', label: 'S4' },
  terms,
  viewerRole: 'seeker',
  currentHold: null,
}
const render = (props: Partial<HoldUnitPanelProps>) =>
  renderToStaticMarkup(<HoldUnitPanel {...base} {...props} />)
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

describe('HoldUnitPanel (design §3)', () => {
  it('offers a Seeker the fee, the fitting wait windows (shortest chosen) and "Hold this unit"', () => {
    const html = render({})
    expect(text(html)).toContain('Hold S4')
    expect(text(html)).toContain(
      "Reservation fee: ₱50.00. You'll have 10 minutes to pay.",
    )
    expect(text(html)).toContain('How long should we keep it after you pay?')
    expect(html.match(/type="radio"/g)).toHaveLength(4)
    // Only the shortest is checked, whatever order React writes the attributes in.
    const checked = html
      .match(/<input[^>]*type="radio"[^>]*>/g)!
      .filter((tag) => tag.includes('checked'))
    expect(checked).toHaveLength(1)
    expect(checked[0]).toContain('value="15"')
    expect(text(html)).toContain('1 hr')
    expect(text(html)).toContain('Hold this unit')
    expect(html).toContain('<fieldset')
    expect(html).toContain('<legend')
  })

  it('lets every button wrap, so 200% text is never cut off inside the Card at 360 px', () => {
    // The PR #297 review measured "Create a Seeker account" running to x=453 on a
    // 360 px screen, clipped by the Card, before these classes.
    const states = {
      'a Seeker': render({}),
      'signed out': render({ viewerRole: null }),
      'already holding': render({
        currentHold: {
          id: '10000000-0000-4000-8000-000000000001',
          unitLabel: 'S2',
          spaceName: 'Kapihan',
        },
      }),
      'no wait window fits': render({ terms: { ...terms, waitWindowMinutes: [] } }),
    }
    for (const [state, html] of Object.entries(states)) {
      const buttons = [...html.matchAll(/class="([^"]*group\/button[^"]*)"/g)].map(
        (match) => match[1] ?? '',
      )
      expect(buttons.length, state).toBeGreaterThan(0)
      for (const classes of buttons) {
        expect(classes, state).toContain('h-auto min-h-12 max-w-full')
        expect(classes, state).toContain('whitespace-normal')
        expect(classes, state).not.toContain('whitespace-nowrap')
      }
    }
  })

  it('posts the list view only when the Seeker is on it, so a refusal keeps it', () => {
    expect(render({ view: 'list' })).toContain('name="view" value="list"')
    expect(render({ view: 'grid' })).not.toContain('name="view"')
    expect(render({})).not.toContain('name="view"')
  })

  it('posts the Space, the unit and its label', () => {
    const html = render({})
    expect(html).toContain(`name="spaceId" value="${spaceId}"`)
    expect(html).toContain(`name="unitId" value="${base.unit.id}"`)
    expect(html).toContain('name="unitLabel" value="S4"')
  })

  it('says no wait window fits, with the closing time in Manila (seeker-no-wait-window-fits)', () => {
    const html = text(render({ terms: { ...terms, waitWindowMinutes: [] } }))
    expect(html).toContain('No wait window fits before this Space closes at 10:00 PM .')
    expect(html).toContain('Back to results')
    expect(html).not.toContain('Hold this unit')
  })

  it('points a Seeker who holds another unit to that hold (D-008)', () => {
    const html = render({
      currentHold: {
        id: '10000000-0000-4000-8000-000000000001',
        unitLabel: 'S2',
        spaceName: 'Kapihan Study Hall',
      },
    })
    expect(text(html)).toContain(
      "You're already holding S2 at Kapihan Study Hall. You can hold one unit at a time.",
    )
    expect(html).toContain(
      'href="/seeker/reservations/10000000-0000-4000-8000-000000000001"',
    )
  })

  it('offers a signed-out visitor sign-in and a Seeker account, both back to this profile (D-058)', () => {
    const html = render({ viewerRole: null })
    const back = encodeURIComponent(`/spaces/${spaceId}`)
    expect(text(html)).toContain(
      "Reservation fee: ₱50.00. You'll have 10 minutes to pay.",
    )
    expect(text(html)).toContain(
      "Holding a unit needs a Seeker account. You'll come back here to pick it again.",
    )
    expect(html).toContain(`href="/login?returnUrl=${back}"`)
    expect(html).toContain(`href="/register?returnUrl=${back}&amp;role=seeker"`)
  })

  it('tells a Host or an Administrator only Seekers can hold, with no sign-in link', () => {
    for (const viewerRole of ['host', 'admin'] as const) {
      const html = render({ viewerRole })
      expect(text(html)).toBe('Only Seeker accounts can hold units.')
      expect(html).not.toContain('/login')
    }
  })
})
