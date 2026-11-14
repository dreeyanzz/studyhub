import { beforeEach, describe, expect, it, vi } from 'vitest'

const { Redirected, revalidatePath, supabase } = vi.hoisted(() => {
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`NEXT_REDIRECT ${url}`)
    }
  }
  const revalidatePath = vi.fn()
  const supabase = {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  }
  return { Redirected, revalidatePath, supabase }
})

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Redirected(url)
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))

import { checkInAction } from './actions'

const SPACE_ID = 'e0000000-0000-4000-8000-000000000002'

async function captureRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn()
  } catch (err) {
    if (err instanceof Redirected) return err.url
    throw err
  }
  throw new Error('Expected redirect')
}

describe('checkInAction (STORY-10, TSK-10.4, C1–C7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'host-1' } } })
  })

  it('returns error without calling the database when spaceId is malformed', async () => {
    const res = await checkInAction('not-a-uuid', 'ABCD-EFGH-JKMN')
    expect(res).toEqual({ outcome: 'error' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects malformed tokens (C6) before hitting the database', async () => {
    const res = await checkInAction(SPACE_ID, 'ABC-123')
    expect(res).toEqual({ outcome: 'invalid_token' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated callers to login with check-in returnUrl', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    const url = await captureRedirect(() => checkInAction(SPACE_ID, 'ABCD-EFGH-JKMN'))
    expect(url).toBe(
      `/login?returnUrl=${encodeURIComponent(`/host/spaces/${SPACE_ID}/check-in`)}`,
    )
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('normalizes token input, calls check_in RPC, and returns C1 success with revalidation', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        outcome: 'success',
        unit_id: 'u-1',
        unit_label: 'S4',
        zone_name: 'Quiet desks',
      },
      error: null,
    })

    const res = await checkInAction(SPACE_ID, 'abcd-efgh-jkmn')
    expect(supabase.rpc).toHaveBeenCalledWith('check_in', {
      p_token: 'ABCDEFGHJKMN',
      p_space_id: SPACE_ID,
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/host/spaces/${SPACE_ID}/occupancy`)
    expect(revalidatePath).toHaveBeenCalledWith(`/host/spaces/${SPACE_ID}/check-in`)
    expect(res).toEqual({
      outcome: 'success',
      unitLabel: 'S4',
      zoneName: 'Quiet desks',
    })
  })

  it('maps wait_window_lapsed JSON outcome (C2) and revalidates occupancy', async () => {
    supabase.rpc.mockResolvedValue({
      data: { outcome: 'wait_window_lapsed', unit_id: 'u-1', unit_label: 'S4' },
      error: null,
    })

    const res = await checkInAction(SPACE_ID, 'ABCDEFGHJKMN')
    expect(revalidatePath).toHaveBeenCalledWith(`/host/spaces/${SPACE_ID}/occupancy`)
    expect(res).toEqual({ outcome: 'wait_window_lapsed', unitLabel: 'S4' })
  })

  it.each([
    ['P0001', 'token_already_used', 'token_already_used'],
    ['P0001', 'reservation_cancelled', 'reservation_cancelled'],
    ['P0001', 'wrong_space', 'wrong_space'],
    ['P0001', 'invalid_token', 'invalid_token'],
    ['P0001', 'invalid_state', 'invalid_token'],
    ['42501', undefined, 'forbidden'],
    ['XX000', undefined, 'error'],
  ] as const)(
    'translates SQLSTATE %s (hint: %s) into outcome %s',
    async (code, hint, expected) => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { code, hint: hint ?? null },
      })

      const res = await checkInAction(SPACE_ID, 'ABCDEFGHJKMN')
      expect(res).toEqual({ outcome: expected })
      expect(revalidatePath).not.toHaveBeenCalled()
    },
  )
})
