import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../reservations/[id]/actions', () => ({
  startCheckout: vi.fn(),
  cancelHold: vi.fn(),
}))

import type { MyReservation } from '@/lib/data/reservations'

import { CurrentHoldCard } from './current-hold-card'

const hold: MyReservation = {
  id: '10000000-0000-4000-8000-000000000001',
  status: 'pending_payment',
  paymentStatus: 'pending',
  feeAmount: 5000,
  spaceId: 'e0000000-0000-4000-8000-000000000002',
  spaceName: 'Kapihan Study Hall',
  spaceAddress: '12 Mabini St',
  unitId: 'f0000000-0000-4000-8000-000000000017',
  unitLabel: 'S4',
  zoneName: 'Quiet desks',
  waitWindowMinutes: 60,
  paymentWindowEndsAt: '2026-11-14T07:42:00Z',
  waitWindowEndsAt: null,
  bookingToken: null,
  checkoutSessionId: null,
  checkoutUrl: null,
  endedAt: null,
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

describe('CurrentHoldCard (design §3)', () => {
  it('shows an unpaid hold: the unit, Pending Payment, and when to pay by', () => {
    const html = renderToStaticMarkup(<CurrentHoldCard hold={hold} />)
    expect(text(html)).toContain('S4 at Kapihan Study Hall')
    expect(text(html)).toContain('Pending Payment')
    expect(text(html)).toContain('Pay by 3:42 PM')
    expect(html).toContain(`href="/seeker/reservations/${hold.id}"`)
    expect(text(html)).toContain('View your hold')
  })

  it('lets the badge and the link wrap, so 200% text stays on a 360 px screen', () => {
    const html = renderToStaticMarkup(<CurrentHoldCard hold={hold} />)
    expect(html).not.toContain('whitespace-nowrap')
    expect(html.match(/whitespace-normal/g)).toHaveLength(2)
  })

  it('shows a paid hold: Reserved, and when to check in by', () => {
    const html = text(
      renderToStaticMarkup(
        <CurrentHoldCard
          hold={{
            ...hold,
            status: 'reserved',
            paymentStatus: 'paid',
            waitWindowEndsAt: '2026-11-14T08:42:00Z',
          }}
        />,
      ),
    )
    expect(html).toContain('Reserved')
    expect(html).toContain('Check in by 4:42 PM')
  })

  it('shows nothing with no hold, or once checked in (STORY-10)', () => {
    expect(renderToStaticMarkup(<CurrentHoldCard hold={null} />)).toBe('')
    expect(
      renderToStaticMarkup(<CurrentHoldCard hold={{ ...hold, status: 'occupied' }} />),
    ).toBe('')
  })
})
