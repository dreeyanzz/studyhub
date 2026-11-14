import { describe, expect, it } from 'vitest'

import {
  confirmOutcomeSchema,
  paidEventSchema,
  reservationIdOf,
  stripeEventSchema,
} from './stripe'

const reservationId = '10000000-0000-4000-8000-000000000001'

describe('stripeEventSchema', () => {
  it('reads the id, type and livemode, and keeps the data object', () => {
    const event = stripeEventSchema.parse({
      id: 'evt_1',
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      api_version: '2026-09-30',
      data: { object: { id: 'cs_test_1' } },
    })
    expect(event).toEqual({
      id: 'evt_1',
      type: 'checkout.session.completed',
      livemode: false,
      data: { object: { id: 'cs_test_1' } },
    })
  })

  it('refuses an event with no livemode or no data', () => {
    expect(
      stripeEventSchema.safeParse({ id: 'evt_1', type: 'x', data: { object: {} } })
        .success,
    ).toBe(false)
    expect(
      stripeEventSchema.safeParse({ id: 'evt_1', type: 'x', livemode: false }).success,
    ).toBe(false)
  })
})

describe('paidEventSchema', () => {
  const session = {
    id: 'cs_test_1',
    object: 'checkout.session',
    payment_status: 'paid',
    payment_intent: 'pi_test_1',
    metadata: { reservation_id: reservationId },
  }

  it("reads the session's id, payment status, PaymentIntent and metadata", () => {
    expect(paidEventSchema.parse(session)).toEqual({
      id: 'cs_test_1',
      payment_status: 'paid',
      payment_intent: 'pi_test_1',
      metadata: { reservation_id: reservationId },
    })
  })

  it('takes a null PaymentIntent and missing metadata, which the route then checks', () => {
    expect(paidEventSchema.safeParse({ ...session, payment_intent: null }).success).toBe(
      true,
    )
    expect(paidEventSchema.safeParse({ ...session, metadata: undefined }).success).toBe(
      true,
    )
  })

  it('refuses ids that are not a Checkout Session and a PaymentIntent', () => {
    expect(paidEventSchema.safeParse({ ...session, id: 'pi_test_1' }).success).toBe(false)
    expect(
      paidEventSchema.safeParse({ ...session, payment_intent: 'pay_test_1' }).success,
    ).toBe(false)
  })
})

describe('reservationIdOf', () => {
  const base = { id: 'cs_test_1', payment_status: 'paid', payment_intent: 'pi_test_1' }

  it('returns the metadata reservation id when it is a UUID', () => {
    expect(
      reservationIdOf({ ...base, metadata: { reservation_id: reservationId } }),
    ).toBe(reservationId)
  })

  it('returns null with no metadata, or no valid id', () => {
    expect(reservationIdOf({ ...base, metadata: null })).toBeNull()
    expect(reservationIdOf({ ...base, metadata: {} })).toBeNull()
    expect(
      reservationIdOf({ ...base, metadata: { reservation_id: "1' or 1=1" } }),
    ).toBeNull()
  })
})

describe('confirmOutcomeSchema', () => {
  it("takes each of confirm_payment's outcomes", () => {
    for (const outcome of [
      'confirmed',
      'already_processed',
      'late_payment',
      'not_found',
    ]) {
      expect(confirmOutcomeSchema.safeParse({ outcome }).success).toBe(true)
    }
    expect(confirmOutcomeSchema.safeParse({ outcome: 'refunded' }).success).toBe(false)
  })
})
