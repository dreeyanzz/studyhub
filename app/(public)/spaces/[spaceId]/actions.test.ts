import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock factories run before this file's own code, so what they use is hoisted.
const { Redirected, revalidatePath, supabase } = vi.hoisted(() => {
  // redirect() throws in Next. Here it throws something the tests can read.
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`NEXT_REDIRECT ${url}`)
    }
  }
  return {
    Redirected,
    revalidatePath: vi.fn(),
    supabase: {
      auth: { getUser: vi.fn() },
      rpc: vi.fn(),
      from: vi.fn(),
    },
  }
})
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Redirected(url)
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))

import {
  deleteReviewAction,
  editReviewAction,
  holdUnit,
  postReviewAction,
  reportReviewAction,
  type ReportReviewActionState,
  type ReviewActionState,
} from './actions'

const spaceId = 'e0000000-0000-4000-8000-000000000002'
const unitId = 'f0000000-0000-4000-8000-000000000017'
const reservationId = '10000000-0000-4000-8000-000000000001'
const reviewId = '20000000-0000-4000-8000-000000000001'
const profile = `/spaces/${spaceId}`
const idle: ReviewActionState = { status: 'idle', message: null }

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

function reviewForm(overrides: Record<string, string> = {}) {
  const data = new FormData()
  const fields = {
    spaceId,
    reservationId,
    reviewId,
    quietness: '5',
    wifiReliability: '4',
    cleanliness: '5',
    comfort: '4',
    comment: '  Great quiet desks.  ',
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

  it('keeps the accessible list view through a refusal (SRS §3.2.2)', async () => {
    holdAnswers({ data: null, error: { code: 'P0001', hint: 'unit_not_available' } })
    expect(await landing(holdUnit(form({ view: 'list' })))).toBe(
      `${profile}?view=list&unit=${unitId}&refused=unit_not_available`,
    )
    expect(await landing(holdUnit(form({ view: 'list', waitWindowMinutes: '20' })))).toBe(
      `${profile}?view=list&refused=error`,
    )
    // Anything else is the default grid, and never reaches the URL.
    expect(await landing(holdUnit(form({ view: '"><script>' })))).toBe(
      `${profile}?unit=${unitId}&refused=unit_not_available`,
    )
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

describe('postReviewAction (STORY-13, RV1, §1 & §4)', () => {
  it('inserts the trimmed review and revalidates the profile and /spaces', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    supabase.from.mockImplementation((table: string) => {
      if (table === 'reviews') return { insert }
      throw new Error(`unexpected table ${table}`)
    })

    const result = await postReviewAction(idle, reviewForm())

    expect(result).toEqual({ status: 'success', message: 'Review posted.' })
    expect(insert).toHaveBeenCalledWith({
      reservation_id: reservationId,
      space_id: spaceId,
      quietness: 5,
      wifi_reliability: 4,
      cleanliness: 5,
      comfort: 4,
      comment: 'Great quiet desks.',
    })
    expect(revalidatePath).toHaveBeenCalledWith(profile)
    expect(revalidatePath).toHaveBeenCalledWith('/spaces')
  })

  it('maps 42501 (no visit / wrong role) and 23505 (duplicate visit) to §1 messages', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: '42501' } })
      .mockResolvedValueOnce({ error: { code: '23505' } })
    supabase.from.mockReturnValue({ insert })

    expect(await postReviewAction(idle, reviewForm())).toEqual({
      status: 'error',
      message: 'You can review a Space only after checking in there',
    })
    expect(await postReviewAction(idle, reviewForm())).toEqual({
      status: 'error',
      message: 'You have already reviewed this visit',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns field validation errors without hitting the database, and refuses signed-out callers', async () => {
    const invalid = await postReviewAction(idle, reviewForm({ quietness: '0' }))
    expect(invalid.status).toBe('error')
    expect(invalid.fieldErrors?.quietness).toBeTruthy()
    expect(supabase.from).not.toHaveBeenCalled()

    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await postReviewAction(idle, reviewForm())).toEqual({
      status: 'error',
      message: 'You can review a Space only after checking in there',
    })
  })
})

describe('editReviewAction (STORY-13, RV2, §1 & §4)', () => {
  function mockUpdate(answer: { data: unknown; error: unknown }) {
    const select = vi.fn(async () => answer)
    const eqSpace = vi.fn(() => ({ select }))
    const eqId = vi.fn(() => ({ eq: eqSpace }))
    const update = vi.fn(() => ({ eq: eqId }))
    supabase.from.mockReturnValue({ update })
    return { update, eqId, eqSpace }
  }

  it('updates the visible review and revalidates the profile and /spaces', async () => {
    const { update, eqId, eqSpace } = mockUpdate({
      data: [{ id: reviewId }],
      error: null,
    })

    const result = await editReviewAction(idle, reviewForm({ comment: '   ' }))

    expect(result).toEqual({ status: 'success', message: 'Review updated.' })
    expect(update).toHaveBeenCalledWith({
      quietness: 5,
      wifi_reliability: 4,
      cleanliness: 5,
      comfort: 4,
      comment: null,
    })
    expect(eqId).toHaveBeenCalledWith('id', reviewId)
    expect(eqSpace).toHaveBeenCalledWith('space_id', spaceId)
    expect(revalidatePath).toHaveBeenCalledWith(profile)
    expect(revalidatePath).toHaveBeenCalledWith('/spaces')
  })

  it('turns 0 rows (hidden, removed, or not theirs, N4/N5) and 42501 into §1 message', async () => {
    mockUpdate({ data: [], error: null })
    expect(await editReviewAction(idle, reviewForm())).toEqual({
      status: 'error',
      message: "This review can't be changed now",
    })

    mockUpdate({ data: null, error: { code: '42501' } })
    expect(await editReviewAction(idle, reviewForm())).toEqual({
      status: 'error',
      message: "This review can't be changed now",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('deleteReviewAction (STORY-13, RV3, §1 & §4)', () => {
  function mockDelete(answer: { data: unknown; error: unknown }) {
    const select = vi.fn(async () => answer)
    const eqSpace = vi.fn(() => ({ select }))
    const eqId = vi.fn(() => ({ eq: eqSpace }))
    const del = vi.fn(() => ({ eq: eqId }))
    supabase.from.mockReturnValue({ delete: del })
    return { del, eqId, eqSpace }
  }

  it('deletes the visible review and revalidates the profile and /spaces', async () => {
    const { eqId, eqSpace } = mockDelete({ data: [{ id: reviewId }], error: null })

    const result = await deleteReviewAction({ spaceId, reviewId })

    expect(result).toEqual({ status: 'success', message: 'Review deleted.' })
    expect(eqId).toHaveBeenCalledWith('id', reviewId)
    expect(eqSpace).toHaveBeenCalledWith('space_id', spaceId)
    expect(revalidatePath).toHaveBeenCalledWith(profile)
    expect(revalidatePath).toHaveBeenCalledWith('/spaces')
  })

  it('turns 0 rows (hidden, removed, or not theirs, N4/N5) and 42501 into §1 message', async () => {
    mockDelete({ data: [], error: null })
    expect(await deleteReviewAction({ spaceId, reviewId })).toEqual({
      status: 'error',
      message: "This review can't be changed now",
    })

    mockDelete({ data: null, error: { code: '42501' } })
    expect(await deleteReviewAction({ spaceId, reviewId })).toEqual({
      status: 'error',
      message: "This review can't be changed now",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('reportReviewAction (STORY-13, TSK-13.5, RP1, N11, §1 & §4)', () => {
  const idleReport: ReportReviewActionState = { status: 'idle', message: null }

  function reportForm(overrides: Record<string, string> = {}) {
    const fd = new FormData()
    const values: Record<string, string> = {
      spaceId,
      reviewId,
      reason: 'spam',
      note: 'Promotional link in comment.',
      ...overrides,
    }
    for (const [key, val] of Object.entries(values)) {
      fd.set(key, val)
    }
    return fd
  }

  it('rejects invalid reason or overly long note before touching Supabase', async () => {
    const badReason = await reportReviewAction(idleReport, reportForm({ reason: '' }))
    expect(badReason.status).toBe('error')
    expect(badReason.fieldErrors?.reason).toBe(
      'Choose a reason for reporting this review.',
    )

    const longNote = await reportReviewAction(
      idleReport,
      reportForm({ note: 'a'.repeat(301) }),
    )
    expect(longNote.status).toBe('error')
    expect(longNote.fieldErrors?.note).toContain('300')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('refuses signed-out callers with §1 message', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const result = await reportReviewAction(idleReport, reportForm())
    expect(result).toEqual({
      status: 'error',
      message: "You can't report this review",
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('inserts only granted columns and revalidates the profile on success', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    supabase.from.mockReturnValue({ insert })

    const result = await reportReviewAction(idleReport, reportForm({ note: '   ' }))

    expect(result).toEqual({ status: 'success', message: 'Report submitted.' })
    expect(supabase.from).toHaveBeenCalledWith('review_reports')
    expect(insert).toHaveBeenCalledWith({
      review_id: reviewId,
      reason: 'spam',
      note: null,
    })
    expect(revalidatePath).toHaveBeenCalledWith(profile)
    expect(revalidatePath).not.toHaveBeenCalledWith('/spaces')
  })

  it('turns 42501 and 23505 into §1 refusal messages (N11)', async () => {
    supabase.from.mockReturnValue({
      insert: vi.fn(async () => ({ error: { code: '42501' } })),
    })
    expect(await reportReviewAction(idleReport, reportForm())).toEqual({
      status: 'error',
      message: "You can't report this review",
    })

    supabase.from.mockReturnValue({
      insert: vi.fn(async () => ({ error: { code: '23505' } })),
    })
    expect(await reportReviewAction(idleReport, reportForm())).toEqual({
      status: 'error',
      message: 'You have already reported this review',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
