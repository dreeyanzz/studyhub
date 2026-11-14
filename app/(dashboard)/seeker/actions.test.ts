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

import { checkOutAction } from './actions'

const id = '10000000-0000-4000-8000-000000000001'

async function captureRedirect(fn: () => Promise<void>): Promise<string> {
  try {
    await fn()
  } catch (err) {
    if (err instanceof Redirected) return err.url
    throw err
  }
  throw new Error('Expected redirect')
}

describe('checkOutAction (STORY-10, TSK-10.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'seeker-1' } } })
  })

  it('redirects to /seeker without hitting the database when reservationId is malformed', async () => {
    const url = await captureRedirect(() => checkOutAction('not-a-uuid'))
    expect(url).toBe('/seeker')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('redirects signed-out callers to login', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    const url = await captureRedirect(() => checkOutAction(id))
    expect(url).toBe('/login?returnUrl=%2Fseeker')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('calls public.check_out, revalidates /seeker, and redirects to the ended view on success (R5)', async () => {
    supabase.rpc.mockResolvedValue({
      data: { outcome: 'success', reservation_id: id, unit_id: 'u1' },
      error: null,
    })

    const url = await captureRedirect(() => checkOutAction(id))
    expect(supabase.rpc).toHaveBeenCalledWith('check_out', { p_reservation_id: id })
    expect(revalidatePath).toHaveBeenCalledWith('/seeker')
    expect(url).toBe(`/seeker?reservation=${id}`)
  })

  it('shows the ended view when the visit already closed or ended (hold_ended)', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', hint: 'hold_ended' },
    })

    const url = await captureRedirect(() => checkOutAction(id))
    expect(revalidatePath).toHaveBeenCalledWith('/seeker')
    expect(url).toBe(`/seeker?reservation=${id}`)
  })

  it('returns to /seeker when reservation is not checked in (not_checked_in)', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', hint: 'not_checked_in' },
    })

    const url = await captureRedirect(() => checkOutAction(id))
    expect(url).toBe('/seeker')
  })

  it('surfaces a check-out error flag for unauthorized or unexpected database errors (N8)', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', hint: null },
    })

    const url = await captureRedirect(() => checkOutAction(id))
    expect(url).toBe('/seeker?error=check-out')
  })
})
