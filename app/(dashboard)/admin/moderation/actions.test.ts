import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePathMock = vi.fn()
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
const getUserMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  }),
}))

import { moderateReviewAction } from './actions'

const REVIEW_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
  rpcMock.mockResolvedValue({ data: {}, error: null })
})

describe('moderateReviewAction (STORY-14, TSK-14.3)', () => {
  it.each([
    ['hide', 'Review hidden.'],
    ['remove', 'Review removed.'],
    ['restore', 'Review restored.'],
    ['dismiss', 'Reports dismissed.'],
  ] as const)(
    'calls moderate_review for %s and returns "%s"',
    async (action, message) => {
      const result = await moderateReviewAction({
        reviewId: REVIEW_ID,
        action,
        version: 2,
      })

      expect(rpcMock).toHaveBeenCalledWith('moderate_review', {
        p_review_id: REVIEW_ID,
        p_action: action,
        p_version: 2,
      })
      expect(result).toEqual({
        success: true,
        reviewId: REVIEW_ID,
        action,
        message,
      })
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/moderation')
      expect(revalidatePathMock).toHaveBeenCalledWith('/spaces', 'layout')
    },
  )

  it('sends the newest moderation log entry the page saw (N18, #420)', async () => {
    const EVENT_ID = '55555555-5555-4555-8555-555555555555'
    await moderateReviewAction({
      reviewId: REVIEW_ID,
      action: 'remove',
      version: 1,
      lastEventId: EVENT_ID,
    })

    expect(rpcMock).toHaveBeenCalledWith('moderate_review', {
      p_review_id: REVIEW_ID,
      p_action: 'remove',
      p_version: 1,
      p_last_event_id: EVENT_ID,
    })
  })

  it('leaves the entry out when the page saw an empty log, which the function reads as null', async () => {
    await moderateReviewAction({
      reviewId: REVIEW_ID,
      action: 'hide',
      version: 1,
      lastEventId: null,
    })

    const args = rpcMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(args.p_last_event_id).toBeUndefined()
  })

  it('redirects signed-out callers to /login', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    await expect(
      moderateReviewAction({ reviewId: REVIEW_ID, action: 'hide', version: 1 }),
    ).rejects.toThrow('NEXT_REDIRECT:/login?returnUrl=%2Fadmin%2Fmoderation')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns validation error without calling Supabase when input is invalid', async () => {
    const result = await moderateReviewAction({
      reviewId: 'bad-id',
      action: 'hide',
      version: 1,
    })

    expect(result.success).toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('maps stale_version and not_allowed hints to the §3 changed-review message', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'P0001',
        message: 'review was edited since you read it',
        hint: 'stale_version',
      },
    })

    const stale = await moderateReviewAction({
      reviewId: REVIEW_ID,
      action: 'hide',
      version: 1,
    })
    expect(stale).toEqual({
      success: false,
      reviewId: REVIEW_ID,
      error:
        'This review changed since you loaded the page. Refresh to see its latest state.',
      code: 'stale_version',
    })

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'P0001',
        message: 'moderation action is not allowed',
        hint: 'not_allowed',
      },
    })

    const disallowed = await moderateReviewAction({
      reviewId: REVIEW_ID,
      action: 'dismiss',
      version: 2,
    })
    expect(disallowed).toEqual({
      success: false,
      reviewId: REVIEW_ID,
      error:
        'This review changed since you loaded the page. Refresh to see its latest state.',
      code: 'not_allowed',
    })
  })

  it('maps not_found hint to the §3 already-deleted message', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'review not found', hint: 'not_found' },
    })

    const result = await moderateReviewAction({
      reviewId: REVIEW_ID,
      action: 'remove',
      version: 1,
    })
    expect(result).toEqual({
      success: false,
      reviewId: REVIEW_ID,
      error: 'This review was already deleted.',
      code: 'not_found',
    })
  })

  it('maps 42501 permission denied errors cleanly', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    const result = await moderateReviewAction({
      reviewId: REVIEW_ID,
      action: 'hide',
      version: 1,
    })
    expect(result).toEqual({
      success: false,
      reviewId: REVIEW_ID,
      error: 'You are not authorized to moderate reviews.',
      code: 'unauthorized',
    })
  })
})
