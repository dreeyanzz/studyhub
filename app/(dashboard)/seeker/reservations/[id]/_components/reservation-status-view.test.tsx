import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The Server Actions are only form targets here.
vi.mock('../actions', () => ({ startCheckout: vi.fn(), cancelHold: vi.fn() }))

import type { MyReservation } from '@/lib/data/reservations'

import { POLL_DELAYS_MS } from './confirmation-poller'
import {
  BookingToken,
  CancelConfirmation,
  EndedView,
  HoldStatusBadge,
  ReservedView,
} from './reservation-status-view'

const base: MyReservation = {
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
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'")

describe('HoldStatusBadge', () => {
  it('names the status in words, beside its tile icon (never by colour alone)', () => {
    expect(text(renderToStaticMarkup(<HoldStatusBadge status="pending_payment" />))).toBe(
      'Pending Payment',
    )
    const reserved = renderToStaticMarkup(<HoldStatusBadge status="reserved" />)
    expect(text(reserved)).toBe('Reserved')
    expect(reserved).toContain('aria-hidden="true"')
  })
})

describe('BookingToken', () => {
  it('shows ABCD-EFGH-JKMN, each group in its own box so it wraps between groups', () => {
    const html = renderToStaticMarkup(<BookingToken token="ABCDEFGHJKMN" />)
    expect(text(html)).toBe('ABCD-EFGH-JKMN')
    expect(html.match(/whitespace-nowrap/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Booking token ABCD EFGH JKMN"')
  })
})

describe('ReservedView', () => {
  const reserved: MyReservation = {
    ...base,
    status: 'reserved',
    paymentStatus: 'paid',
    bookingToken: 'ABCDEFGHJKMN',
    waitWindowEndsAt: '2026-11-14T08:42:00Z',
  }

  it('shows the unit, the token and the check-in time in Manila', () => {
    const html = text(
      renderToStaticMarkup(
        <ReservedView reservation={reserved} confirmingCancel={false} />,
      ),
    )
    expect(html).toContain('Reserved: S4')
    expect(html).toContain('ABCD-EFGH-JKMN')
    expect(html).toContain('Check in by 4:42 PM.')
    expect(html).toContain('Cancel reservation')
  })

  it('links "Cancel reservation" to the ?cancel=1 step, which works without JavaScript', () => {
    const html = renderToStaticMarkup(
      <ReservedView reservation={reserved} confirmingCancel={false} />,
    )
    expect(html).toContain(`href="/seeker/reservations/${base.id}?cancel=1"`)
  })

  it('asks before forfeiting the fee (R8)', () => {
    const html = text(
      renderToStaticMarkup(<ReservedView reservation={reserved} confirmingCancel />),
    )
    expect(html).toContain('Cancel your reservation?')
    expect(html).toContain(
      'Your ₱50.00 fee will be forfeited, and S4 will be released at once.',
    )
    expect(html).toContain('Keep my reservation')
  })
})

describe('CancelConfirmation for an unpaid hold', () => {
  it('says nothing has been charged, with "Cancel hold" and "Keep my hold"', () => {
    const html = text(renderToStaticMarkup(<CancelConfirmation reservation={base} />))
    expect(html).toContain('Cancel your hold on S4?')
    expect(html).toContain('Nothing has been charged.')
    expect(html).toContain('Cancel hold')
    expect(html).toContain('Keep my hold')
  })
})

describe('EndedView (flow §5, states 3 to 5)', () => {
  const ended = (overrides: Partial<MyReservation>) =>
    text(renderToStaticMarkup(<EndedView reservation={{ ...base, ...overrides }} />))

  it('a late payment (P2): recorded, and an Administrator can refund it', () => {
    const html = ended({ status: 'expired', paymentStatus: 'paid' })
    expect(html).toContain(
      'Your payment window ran out before Stripe confirmed your payment, so S4 was released. Your ₱50.00 payment was recorded, and an Administrator can refund it.',
    )
    expect(html).toContain('Find another Space')
  })

  it('a lapse with no payment: nothing was charged', () => {
    const html = ended({ status: 'expired', paymentStatus: 'pending' })
    expect(html).toContain(
      'Your payment window ran out, and nothing was charged. S4 is open again.',
    )
    expect(html).toContain('Back to Kapihan Study Hall')
  })

  it('a cancelled hold says what happened to the fee', () => {
    expect(ended({ status: 'cancelled', paymentStatus: 'pending' })).toContain(
      'Nothing was charged.',
    )
    expect(ended({ status: 'cancelled', paymentStatus: 'forfeited' })).toContain(
      'Your ₱50.00 fee was forfeited.',
    )
    expect(ended({ status: 'cancelled', paymentStatus: 'paid' })).toContain(
      'Your ₱50.00 payment was recorded, and an Administrator can refund it.',
    )
    expect(ended({ status: 'cancelled' })).toContain('Your hold on S4 has ended.')
  })
})

describe('ConfirmationPoller', () => {
  it('reloads after 1.5, 3, 5, 8 and 13 seconds, about 30 seconds in all', () => {
    expect(POLL_DELAYS_MS).toEqual([1500, 3000, 5000, 8000, 13000])
    expect(POLL_DELAYS_MS.reduce((sum, ms) => sum + ms, 0)).toBe(30500)
  })
})
