import { describe, expect, it } from 'vitest'

import {
  moderateReviewSchema,
  paymentRecordsSchema,
  REFUND_REASON_MAX_LENGTH,
  refundPaymentSchema,
  reviewQueueSchema,
} from './admin'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('moderateReviewSchema (STORY-14, TSK-14.3)', () => {
  it.each(['hide', 'remove', 'restore', 'dismiss'] as const)(
    'accepts valid action %s with a positive integer version',
    (action) => {
      const result = moderateReviewSchema.safeParse({
        reviewId: VALID_UUID,
        action,
        version: 2,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          reviewId: VALID_UUID,
          action,
          version: 2,
        })
      }
    },
  )

  it('coerces a numeric string version', () => {
    const result = moderateReviewSchema.safeParse({
      reviewId: VALID_UUID,
      action: 'hide',
      version: '3',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.version).toBe(3)
  })

  it('rejects unknown actions, invalid UUIDs, and non-positive or decimal versions', () => {
    expect(
      moderateReviewSchema.safeParse({
        reviewId: VALID_UUID,
        action: 'delete',
        version: 1,
      }).success,
    ).toBe(false)

    expect(
      moderateReviewSchema.safeParse({
        reviewId: 'not-a-uuid',
        action: 'hide',
        version: 1,
      }).success,
    ).toBe(false)

    expect(
      moderateReviewSchema.safeParse({
        reviewId: VALID_UUID,
        action: 'hide',
        version: 0,
      }).success,
    ).toBe(false)

    expect(
      moderateReviewSchema.safeParse({
        reviewId: VALID_UUID,
        action: 'hide',
        version: 1.5,
      }).success,
    ).toBe(false)
  })

  it('takes the newest moderation log entry as a UUID, null, or left out (N18)', () => {
    const base = { reviewId: VALID_UUID, action: 'remove' as const, version: 1 }
    const EVENT_ID = '55555555-5555-4555-8555-555555555555'

    const withEntry = moderateReviewSchema.safeParse({ ...base, lastEventId: EVENT_ID })
    expect(withEntry.success && withEntry.data.lastEventId).toBe(EVENT_ID)
    expect(moderateReviewSchema.safeParse({ ...base, lastEventId: null }).success).toBe(
      true,
    )
    expect(moderateReviewSchema.safeParse(base).success).toBe(true)
    expect(
      moderateReviewSchema.safeParse({ ...base, lastEventId: 'not-a-uuid' }).success,
    ).toBe(false)
  })
})

describe('reviewQueueSchema (STORY-14, TSK-14.3)', () => {
  it('defaults to reported and 25 when params are omitted or invalid', () => {
    expect(reviewQueueSchema.parse({})).toEqual({ list: 'reported', show: 25 })
    expect(reviewQueueSchema.parse({ list: 'bogus', show: '999' })).toEqual({
      list: 'reported',
      show: 25,
    })
    expect(reviewQueueSchema.parse({ list: 'hidden', show: '30' })).toEqual({
      list: 'hidden',
      show: 25,
    })
  })

  it('accepts reported, hidden, removed and show steps 25, 50, 75, 100', () => {
    expect(reviewQueueSchema.parse({ list: 'reported', show: '25' })).toEqual({
      list: 'reported',
      show: 25,
    })
    expect(reviewQueueSchema.parse({ list: 'hidden', show: '50' })).toEqual({
      list: 'hidden',
      show: 50,
    })
    expect(reviewQueueSchema.parse({ list: 'removed', show: '100' })).toEqual({
      list: 'removed',
      show: 100,
    })
    expect(
      reviewQueueSchema.parse({ list: ['hidden', 'removed'], show: ['75'] }),
    ).toEqual({
      list: 'hidden',
      show: 75,
    })
  })
})

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
