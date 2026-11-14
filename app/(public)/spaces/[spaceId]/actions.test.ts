import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock factories run before this file's own code, so what they use is hoisted.
const { Redirected, supabase } = vi.hoisted(() => {
  // redirect() throws in Next. Here it throws something the tests can read.
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`NEXT_REDIRECT ${url}`)
    }
  }
  return { Redirected, supabase: { auth: { getUser: vi.fn() }, rpc: vi.fn() } }
})
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Redirected(url)
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))

import { holdUnit } from './actions'

const spaceId = 'e0000000-0000-4000-8000-000000000002'
const unitId = 'f0000000-0000-4000-8000-000000000017'
const reservationId = '10000000-0000-4000-8000-000000000001'
const profile = `/spaces/${spaceId}`

function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  const fields = {
    spaceId,
    unitId,
    unitLabel: 'S4',
    waitWindowMinutes: '30',
    ...overrides,
  }
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

function holdAnswers(answer: { data: unknown; error: unknown }) {
  supabase.rpc.mockImplementation((name: string) => {
    if (name === 'hold_unit') return { maybeSingle: async () => answer }
    throw new Error(`unexpected rpc ${name}`)
  })
}

async function landing(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof Redirected) return error.url
    throw error
  }
  throw new Error('expected a redirect')
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'seeker' } } })
})

describe('holdUnit (R1, design §3)', () => {
  it('holds the unit for the chosen wait window and opens the hold page', async () => {
    holdAnswers({
      data: { reservation_id: reservationId, status: 'pending_payment' },
      error: null,
    })
    expect(await landing(holdUnit(form()))).toBe(`/seeker/reservations/${reservationId}`)
    expect(supabase.rpc).toHaveBeenCalledWith('hold_unit', {
      p_unit_id: unitId,
      p_wait_window_minutes: 30,
    })
  })

  it('sends a signed-out visitor to log in, back to the profile with no unit (D-058)', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await landing(holdUnit(form()))).toBe(
      `/login?returnUrl=${encodeURIComponent(profile)}`,
    )
  })

  it('refuses a wait window that is not one of the steps, before any database call', async () => {
    holdAnswers({ data: null, error: null })
    expect(await landing(holdUnit(form({ waitWindowMinutes: '20' })))).toBe(
      `${profile}?refused=error`,
    )
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('sends a malformed Space id to the search page', async () => {
    expect(await landing(holdUnit(form({ spaceId: 'nope' })))).toBe('/spaces')
  })

  it('comes back to the same unit with the refusal, so the profile rereads availability (N1 to N5)', async () => {
    const cases: [{ code: string; hint?: string }, string][] = [
      [{ code: 'P0001', hint: 'unit_not_available' }, 'unit_not_available'],
      [{ code: 'P0001', hint: 'seeker_has_hold' }, 'seeker_has_hold'],
      [{ code: 'P0001', hint: 'space_closed' }, 'space_closed'],
      [{ code: '42501' }, 'not_seeker'],
      [{ code: 'P0001', hint: 'something_new' }, 'error'],
      [{ code: 'XX000' }, 'error'],
    ]
    for (const [error, reason] of cases) {
      holdAnswers({ data: null, error })
      expect(await landing(holdUnit(form()))).toBe(
        `${profile}?unit=${unitId}&refused=${reason}`,
      )
    }
  })
})
