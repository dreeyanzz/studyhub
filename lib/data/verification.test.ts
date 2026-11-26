import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'
import { getVerificationSpaces, pendingOrigin, toSpaceEvents } from './verification'

const SPACE_ID = 'e0000000-0000-4000-8000-000000000001'

function event(overrides: Record<string, unknown>) {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    space_id: SPACE_ID,
    from_status: null,
    to_status: null,
    reason: null,
    old_name: null,
    new_name: null,
    old_address: null,
    new_address: null,
    old_latitude: null,
    new_latitude: null,
    old_longitude: null,
    new_longitude: null,
    actor_id: 'b0000000-0000-4000-8000-000000000001',
    created_at: '2026-11-20T00:00:00Z',
    profiles: { full_name: 'Ana Admin' },
    ...overrides,
  } as Parameters<typeof toSpaceEvents>[0][number]
}

describe('pendingOrigin (STORY-20 design §2)', () => {
  it('has no mark for a Space that was never moved', () => {
    expect(pendingOrigin('pending', [])).toBeNull()
  })

  it('reads "Edited" after V6 and "Resubmitted" after V8, from the latest arrival', () => {
    expect(
      pendingOrigin('pending', [{ from_status: 'verified', to_status: 'pending' }]),
    ).toBe('edited')
    for (const from of ['rejected', 'taken_down'] as const) {
      expect(
        pendingOrigin('pending', [
          { from_status: null, to_status: null },
          { from_status: from, to_status: 'pending' },
          { from_status: 'verified', to_status: 'pending' },
        ]),
      ).toBe('resubmitted')
    }
  })

  it('has no mark outside the Pending list', () => {
    expect(
      pendingOrigin('verified', [{ from_status: 'verified', to_status: 'pending' }]),
    ).toBeNull()
  })
})

describe('toSpaceEvents (D-086)', () => {
  it('lists newest first and marks entries since the last move to Verified', () => {
    const events = toSpaceEvents([
      event({ id: 'e1', created_at: '2026-11-01T00:00:00Z', to_status: 'pending' }),
      event({
        id: 'e2',
        created_at: '2026-11-02T00:00:00Z',
        from_status: 'pending',
        to_status: 'verified',
      }),
      event({ id: 'e3', created_at: '2026-11-03T00:00:00Z', new_name: 'New' }),
    ])

    expect(events.map((e) => e.id)).toEqual(['e3', 'e2', 'e1'])
    expect(events.map((e) => e.sinceLastVerified)).toEqual([true, false, false])
  })

  it('marks every entry when the Space was never Verified', () => {
    const events = toSpaceEvents([event({ id: 'e1' }), event({ id: 'e2' })])
    expect(events.every((e) => e.sinceLastVerified)).toBe(true)
  })

  it('breaks a tie on created_at by id, newest id first', () => {
    const events = toSpaceEvents([event({ id: 'a' }), event({ id: 'b' })])
    expect(events.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('says when the account that made a change was deleted', () => {
    const [deleted] = toSpaceEvents([event({ actor_id: null, profiles: null })])
    expect(deleted).toMatchObject({ actorName: null, actorDeleted: true })
  })
})

function client(result: { data: unknown; error: unknown }) {
  const order = vi.fn()
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order,
  }
  // The first order() call chains; the second resolves the query.
  order.mockImplementationOnce(() => query).mockImplementationOnce(async () => result)
  const bucket = {
    list: vi.fn(async () => ({
      data: [{ name: 'a.jpg' }, { name: '.keep' }],
      error: null,
    })),
    getPublicUrl: vi.fn((path: string) => ({
      data: { publicUrl: `https://cdn/${path}` },
    })),
  }
  const supabase = {
    from: vi.fn(() => query),
    storage: { from: vi.fn(() => bucket) },
  }
  return { supabase: supabase as unknown as SupabaseClient<Database>, query }
}

describe('getVerificationSpaces (STORY-20, TSK-20.3)', () => {
  const row = {
    id: SPACE_ID,
    name: 'Kapihan Study Hub',
    description: null,
    address: '123 Cebu Tech Park',
    opens_at: '08:00:00',
    closes_at: '22:00:00',
    status: 'pending',
    status_reason: 'Photos were blurry.',
    status_changed_at: '2026-11-20T00:00:00Z',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-20T00:00:00Z',
    profiles: { full_name: 'Hugo Santos' },
    space_events: [event({ from_status: 'rejected', to_status: 'pending' })],
  }

  it('reads Pending oldest first, with the Host, reason, origin and photos', async () => {
    const { supabase, query } = client({ data: [row], error: null })

    const result = await getVerificationSpaces(supabase, 'pending')

    expect(query.eq).toHaveBeenCalledWith('status', 'pending')
    expect(query.order).toHaveBeenNthCalledWith(1, 'status_changed_at', {
      ascending: true,
    })
    expect((query.select.mock.calls as unknown as string[][])[0]?.[0]).toContain(
      'profiles!spaces_host_id_fkey',
    )
    expect(result).toMatchObject({
      ok: true,
      spaces: [
        {
          host_name: 'Hugo Santos',
          status_reason: 'Photos were blurry.',
          origin: 'resubmitted',
          photos: [`https://cdn/${SPACE_ID}/a.jpg`],
        },
      ],
    })
  })

  it('reads the other lists newest first', async () => {
    const { supabase, query } = client({ data: [], error: null })

    await getVerificationSpaces(supabase, 'taken_down')

    expect(query.eq).toHaveBeenCalledWith('status', 'taken_down')
    expect(query.order).toHaveBeenNthCalledWith(1, 'status_changed_at', {
      ascending: false,
    })
  })

  it('reports a failed read', async () => {
    const { supabase } = client({ data: null, error: { message: 'boom' } })
    expect(await getVerificationSpaces(supabase, 'verified')).toEqual({ ok: false })
  })
})
