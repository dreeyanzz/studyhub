import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { SpaceEventItem } from '@/lib/data/verification'
import { describeSpaceEvent, SpaceEventsList } from './space-events-list'
import { VerificationCard, type VerificationCardItem } from './verification-card'

const space: VerificationCardItem = {
  id: 'e0000000-0000-4000-8000-000000000001',
  name: 'Kapihan Study Hub',
  description: null,
  address: '123 Cebu Tech Park, Cebu City',
  opens_at: '08:00:00',
  closes_at: '22:00:00',
  status: 'pending',
  status_reason: null,
  status_changed_at: '2026-11-20T08:00:00Z',
  created_at: '2026-11-01T08:00:00Z',
  updated_at: '2026-11-01T08:00:00Z',
  host_name: 'Hugo Santos',
  origin: null,
  events: [],
}

const render = (
  item: VerificationCardItem,
  options: { onInspect?: () => void; stale?: boolean } = {},
) =>
  renderToStaticMarkup(
    <VerificationCard
      space={item}
      onAction={async () => {}}
      onInspect={options.onInspect}
      stale={options.stale}
    />,
  )

/** The visible labels of the card's buttons, without the sr-only Space name. */
const buttons = (html: string) =>
  [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) =>
    (m[1] ?? '')
      .replace(/<span class="sr-only">[^<]*<\/span>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim(),
  )

describe('VerificationCard (STORY-15 design A3, STORY-17)', () => {
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
    const html = render(space, { onInspect: () => {} })

    expect(html).toContain('Inspect')
    expect(html).toContain('<span class="sr-only"> Kapihan Study Hub</span>')
  })
})

describe('VerificationCard in each list (STORY-20, TSK-20.3)', () => {
  it.each([
    ['pending', ['Reject', 'Approve'], 'Pending verification', 'Waiting since:'],
    ['verified', ['Take down'], 'Verified', 'Verified:'],
    ['rejected', ['Undo'], 'Rejected', 'Rejected:'],
    ['taken_down', ['Put back'], 'Taken down', 'Taken down:'],
  ] as const)(
    'a %s Space shows its status, timestamp and buttons',
    (status, labels, badge, stamp) => {
      const html = render({ ...space, status })

      expect(buttons(html)).toEqual(labels)
      expect(html).toContain(`>${badge}</span>`)
      expect(html).toContain(stamp)
      expect(html).toContain('<time dateTime="2026-11-20T08:00:00Z">')
    },
  )

  it('names the Space in every decision button for screen readers', () => {
    for (const status of ['pending', 'verified', 'rejected', 'taken_down'] as const) {
      const html = render({ ...space, status })
      const count = html.match(
        /<span class="sr-only"> Kapihan Study Hub<\/span>/g,
      )?.length
      expect(count).toBe(buttons(html).length)
    }
  })

  it('marks an Edited or Resubmitted Pending Space, with the previous reason', () => {
    expect(render({ ...space, origin: 'edited' })).toContain('>Edited</span>')

    const html = render({
      ...space,
      origin: 'resubmitted',
      status_reason: 'Photos were blurry.',
    })
    expect(html).toContain('>Resubmitted</span>')
    expect(html).toContain('Previous reason:')
    expect(html).toContain('Photos were blurry.')
  })

  it('shows the reason on a Rejected or Taken down Space, as plain text', () => {
    const html = render({
      ...space,
      status: 'taken_down',
      status_reason: '<b>Closed</b>',
    })
    expect(html).toContain('Reason:')
    expect(html).toContain('&lt;b&gt;Closed&lt;/b&gt;')
  })

  it('pauses every decision on a stale Space and offers a reload (D-086)', () => {
    const html = render(space, { stale: true })

    expect(html).toContain('Updated by Host')
    expect(html).toContain('Kapihan Study Hub was just changed.')
    expect(html).toMatch(/role="status"/)
    for (const button of html.match(/<button[^>]*>/g) ?? []) {
      if (!/Reload latest version/.test(button)) continue
      expect(button).not.toContain('disabled')
    }
    const approve = html.match(/<button[^>]*>(?:(?!<\/button>).)*Approve/)?.[0]
    expect(approve).toContain('disabled=""')
  })
})

function event(overrides: Partial<SpaceEventItem>): SpaceEventItem {
  return {
    id: 'a1',
    fromStatus: null,
    toStatus: null,
    reason: null,
    oldName: null,
    newName: null,
    oldAddress: null,
    newAddress: null,
    oldLatitude: null,
    newLatitude: null,
    oldLongitude: null,
    newLongitude: null,
    actorName: 'Ana Admin',
    actorDeleted: false,
    createdAt: '2026-11-20T08:00:00Z',
    sinceLastVerified: false,
    ...overrides,
  }
}

describe('SpaceEventsList (D-086)', () => {
  it('says when nothing has changed yet', () => {
    expect(renderToStaticMarkup(<SpaceEventsList events={[]} />)).toContain(
      'No changes recorded yet.',
    )
  })

  it('writes status moves and identity changes as old → new', () => {
    expect(
      describeSpaceEvent(
        event({ fromStatus: 'verified', toStatus: 'taken_down', reason: 'Closed' }),
      ),
    ).toEqual(['Verified → Taken down', 'Reason: Closed'])
    expect(
      describeSpaceEvent(
        event({
          oldName: 'Old',
          newName: 'New',
          oldAddress: '1 A St',
          newAddress: '2 B St',
          newLatitude: 10.3,
          newLongitude: 123.9,
        }),
      ),
    ).toEqual([
      'Name: Old → New',
      'Address: 1 A St → 2 B St',
      'Map pin: None → 10.3, 123.9',
    ])
  })

  it('marks "Latest" and "Since last verified" in words, and deleted actors', () => {
    const html = renderToStaticMarkup(
      <SpaceEventsList
        events={[
          event({
            id: 'a2',
            sinceLastVerified: true,
            actorDeleted: true,
            actorName: null,
          }),
          event({ id: 'a1' }),
        ]}
      />,
    )
    expect(html.match(/>Latest</g)).toHaveLength(1)
    expect(html.match(/>Since last verified</g)).toHaveLength(1)
    expect(html).toContain('Deleted account')
    expect(html).toContain('aria-label="List of changes"')
  })
})
