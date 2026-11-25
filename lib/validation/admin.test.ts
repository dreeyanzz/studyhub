import { describe, expect, it } from 'vitest'

import { moderateReviewSchema, reviewQueueSchema } from './admin'

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
