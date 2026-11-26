import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('../actions', () => ({
  checkOutAction: vi.fn(),
}))
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
  checkedInAt: null,
  endedAt: null,
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

describe('CurrentHoldCard (STORY-09 & STORY-10 design §3)', () => {
  it('shows an unpaid hold: the unit, Pending Payment, live countdown, and when to pay by', () => {
    const html = renderToStaticMarkup(<CurrentHoldCard hold={hold} />)
    expect(text(html)).toContain('S4 at Kapihan Study Hall')
    expect(text(html)).toContain('Pending Payment')
    expect(text(html)).toContain('Pay by 3:42 PM')
    expect(text(html)).toContain('min left)')
    expect(html).toContain(`href="/seeker/reservations/${hold.id}"`)
    expect(text(html)).toContain('View your hold')
  })

  it('lets the badge and the link wrap, so 200% text stays on a 360 px screen', () => {
    const html = renderToStaticMarkup(<CurrentHoldCard hold={hold} />)
    expect(html).not.toContain('whitespace-nowrap')
    expect(html.match(/whitespace-normal/g)).toHaveLength(2)
  })

  it('shows a reserved hold: QR code, grouped token, copy button, countdown and cancel link', () => {
    const raw = renderToStaticMarkup(
      <CurrentHoldCard
        hold={{
          ...hold,
          status: 'reserved',
          paymentStatus: 'paid',
          bookingToken: 'ABCDEFGHJKMN',
          waitWindowEndsAt: '2026-11-14T08:42:00Z',
        }}
      />,
    )
    const plain = text(raw)
    expect(plain).toContain('Reserved')
    expect(plain).toContain('Kapihan Study Hall')
    expect(plain).toContain('12 Mabini St')
    expect(plain).toContain('Time remaining to check in:')
    expect(plain).toContain('Check in by 4:42 PM')
    expect(raw).toContain('role="img"')
    expect(raw).toContain('aria-label="Booking QR code for token ABCD-EFGH-JKMN"')
    expect(plain).toContain('Booking token ABCD- EFGH- JKMN')
    expect(plain).toContain('Copy code')
    expect(plain).toContain('Get directions')
    expect(raw).toContain('https://www.google.com/maps/search/?api=1&amp;query=')
    expect(plain).toContain(
      'Present this QR code to the host or recite your code upon arrival.',
    )
    expect(raw).toContain(`href="/seeker/reservations/${hold.id}?cancel=1"`)
  })

  it('shows an occupied visit with arrival time and Check Out confirmation flow', () => {
    const occupied: MyReservation = {
      ...hold,
      status: 'occupied',
      paymentStatus: 'paid',
      checkedInAt: '2026-11-14T08:00:00Z',
    }
    const raw = renderToStaticMarkup(<CurrentHoldCard hold={occupied} />)
    expect(text(raw)).toContain('Checked In · Unit S4 (Quiet desks)')
    expect(text(raw)).toContain('Arrived at 4:00 PM')
    expect(raw).toContain('href="/seeker?checkout=1"')
    // The seat map's Occupied colour, never Available's emerald.
    expect(raw).toContain('bg-amber-50')
    expect(raw).not.toContain('emerald')

    const confirmRaw = renderToStaticMarkup(
      <CurrentHoldCard hold={occupied} confirmingCheckOut />,
    )
    expect(text(confirmRaw)).toContain(
      'Are you ready to leave? This will release unit S4 for other Seekers.',
    )
    expect(text(confirmRaw)).toContain('Check Out')
    expect(confirmRaw).toContain('href="/seeker"')

    const errorRaw = renderToStaticMarkup(
      <CurrentHoldCard hold={occupied} checkOutError />,
    )
    expect(text(errorRaw)).toContain('We could not check you out.')
  })

  it('shows ended states only when showEnded is true', () => {
    expect(renderToStaticMarkup(<CurrentHoldCard hold={null} />)).toBe('')
    expect(
      renderToStaticMarkup(<CurrentHoldCard hold={{ ...hold, status: 'completed' }} />),
    ).toBe('')
    const completedHtml = renderToStaticMarkup(
      <CurrentHoldCard hold={{ ...hold, status: 'completed' }} showEnded />,
    )
    expect(text(completedHtml)).toContain('Visit completed')
    expect(completedHtml).toContain(`href="/spaces/${hold.spaceId}#reviews-heading"`)
    expect(text(completedHtml)).toContain('Leave a review')
    expect(
      text(
        renderToStaticMarkup(
          <CurrentHoldCard
            hold={{ ...hold, status: 'no_show', paymentStatus: 'forfeited' }}
            showEnded
          />,
        ),
      ),
    ).toContain('Wait window lapsed · Unit released')
    expect(
      text(
        renderToStaticMarkup(
          <CurrentHoldCard
            hold={{ ...hold, status: 'no_show', paymentStatus: 'forfeited' }}
            showEnded
          />,
        ),
      ),
    ).toContain('Your ₱50.00 fee was forfeited.')
  })

  it('names a cancelled hold card by its heading, an h2 under the page h1', () => {
    const raw = renderToStaticMarkup(
      <CurrentHoldCard
        hold={{ ...hold, status: 'cancelled', paymentStatus: 'forfeited' }}
        showEnded
      />,
    )
    expect(raw).toContain('aria-labelledby="current-hold-heading"')
    expect(raw).toMatch(
      /<h2 id="current-hold-heading"[^>]*>Your hold on S4 has ended\.<\/h2>/,
    )
    expect(raw).not.toContain('<h1')
  })
})
