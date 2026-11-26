import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock factories run before this file's own code, so what they use is hoisted.
const { Redirected, supabase } = vi.hoisted(() => {
  // redirect() throws in Next. Here it throws something the tests can read.
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`NEXT_REDIRECT ${url}`)
    }
  }
  const supabase = {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  }
  return { Redirected, supabase }
})
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Redirected(url)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))

import { revalidatePath } from 'next/cache'

import { setSpaceStatusAction } from './actions'

const spaceId = 'e0000000-0000-4000-8000-000000000002'
const updatedAt = '2026-11-26T01:02:03.456789+00:00'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin' } } })
  supabase.rpc.mockResolvedValue({ data: { status: 'rejected' }, error: null })
})

describe('setSpaceStatusAction (STORY-15, STORY-20 TSK-20.1)', () => {
  it('sends a rejection with its trimmed reason (N10)', async () => {
    const result = await setSpaceStatusAction({
      spaceId,
      status: 'rejected',
      updatedAt,
      reason: '  The photos show a different building. ',
    })

    expect(result).toEqual({ success: true, spaceId, status: 'rejected' })
    expect(supabase.rpc).toHaveBeenCalledWith('set_space_status', {
      p_space_id: spaceId,
      p_status: 'rejected',
      p_updated_at: updatedAt,
      p_reason: 'The photos show a different building.',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin')
  })

  it('sends an approval without a reason', async () => {
    await setSpaceStatusAction({
      spaceId,
      status: 'verified',
      updatedAt,
      reason: 'Ignored',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('set_space_status', {
      p_space_id: spaceId,
      p_status: 'verified',
      p_updated_at: updatedAt,
    })
  })

  it('refuses a rejection with no reason before calling the database', async () => {
    const result = await setSpaceStatusAction({
      spaceId,
      status: 'rejected',
      updatedAt,
      reason: '   ',
    })

    expect(result).toEqual({
      success: false,
      spaceId,
      error: 'Enter a reason before continuing.',
      fieldErrors: { reason: 'Enter a reason before continuing.' },
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['stale_version', 'P0001', /updated by the host while you were reviewing/],
    [
      'invalid_transition',
      'P0001',
      /status has changed and can no longer take that action/,
    ],
    ['not_found', 'P0001', /This Space no longer exists/],
    ['invalid_reason', 'P0001', /Enter a reason between 1 and 500 characters/],
    ['', '42501', /not authorized to verify spaces/],
    ['', 'XX000', /could not update the space status/],
  ])('maps the database refusal %s (%s)', async (hint, code, message) => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code, hint, message: 'refused', details: null },
    })

    const result = await setSpaceStatusAction({
      spaceId,
      status: 'rejected',
      updatedAt,
      reason: 'A reason',
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(message)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('puts a refused reason on the reason field', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', hint: 'invalid_reason', message: 'refused', details: null },
    })

    const result = await setSpaceStatusAction({
      spaceId,
      status: 'rejected',
      updatedAt,
      reason: 'A reason',
    })

    expect(result).toMatchObject({
      success: false,
      fieldErrors: { reason: 'Enter a reason between 1 and 500 characters.' },
    })
  })

  it('sends a signed-out visitor to log in', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    await expect(
      setSpaceStatusAction({ spaceId, status: 'verified', updatedAt }),
    ).rejects.toMatchObject({ url: '/login?returnUrl=%2Fadmin' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
