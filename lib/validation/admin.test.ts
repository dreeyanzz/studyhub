import { describe, expect, it } from 'vitest'

import {
  paymentRecordsSchema,
  REFUND_REASON_MAX_LENGTH,
  refundPaymentSchema,
} from './admin'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('refundPaymentSchema (STORY-14, TSK-14.4)', () => {
  it('trims a valid reason up to 300 characters', () => {
    const result = refundPaymentSchema.safeParse({
      paymentId: VALID_UUID,
      reason: '   Host could not honour the hold.   ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        paymentId: VALID_UUID,
        reason: 'Host could not honour the hold.',
      })
    }

    const exactLimit = refundPaymentSchema.safeParse({
      paymentId: VALID_UUID,
      reason: `  ${'a'.repeat(REFUND_REASON_MAX_LENGTH)}  `,
    })
    expect(exactLimit.success).toBe(true)
  })

  it('rejects blank reasons, over-300 reasons, and malformed payment IDs', () => {
    expect(
      refundPaymentSchema.safeParse({ paymentId: VALID_UUID, reason: '   ' }).success,
    ).toBe(false)

    expect(
      refundPaymentSchema.safeParse({
        paymentId: VALID_UUID,
        reason: 'a'.repeat(REFUND_REASON_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)

    expect(
      refundPaymentSchema.safeParse({
        paymentId: 'not-a-uuid',
        reason: 'Valid reason',
      }).success,
    ).toBe(false)
  })
})

describe('paymentRecordsSchema (STORY-14, TSK-14.4)', () => {
  it('defaults to all and 25 when params are omitted or invalid', () => {
    expect(paymentRecordsSchema.parse({})).toEqual({ status: 'all', show: 25 })
    expect(paymentRecordsSchema.parse({ status: 'pending', show: '999' })).toEqual({
      status: 'all',
      show: 25,
    })
    expect(paymentRecordsSchema.parse({ status: 'refunded', show: '10' })).toEqual({
      status: 'refunded',
      show: 25,
    })
  })

  it('accepts all, paid, forfeited, refunded, refundable and show steps 25..100', () => {
    expect(paymentRecordsSchema.parse({ status: 'paid', show: '50' })).toEqual({
      status: 'paid',
      show: 50,
    })
    expect(paymentRecordsSchema.parse({ status: 'forfeited', show: '75' })).toEqual({
      status: 'forfeited',
      show: 75,
    })
    expect(paymentRecordsSchema.parse({ status: 'refundable', show: '100' })).toEqual({
      status: 'refundable',
      show: 100,
    })
    expect(
      paymentRecordsSchema.parse({ status: ['refunded', 'paid'], show: ['25'] }),
    ).toEqual({
      status: 'refunded',
      show: 25,
    })
  })
})
