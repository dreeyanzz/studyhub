import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'

import { getHoldTerms, getHoldViewer, getMyReservation } from './reservations'

const id = '10000000-0000-4000-8000-000000000001'
const row = {
  id,
  status: 'pending_payment',
  payment_status: 'pending',
  fee_amount: 5000,
  space_id: 'e0000000-0000-4000-8000-000000000002',
  space_name: 'Sulok Co-working',
  space_address: '12 Mabini St',
  unit_id: 'f0000000-0000-4000-8000-000000000017',
  unit_label: 'U1',
  zone_name: 'Open floor',
  wait_window_minutes: 60,
  payment_window_ends_at: '2026-11-14T07:42:00+00:00',
  wait_window_ends_at: null,
  booking_token: null,
  checkout_session_id: null,
  checkout_url: null,
  created_at: '2026-11-14T07:32:00+00:00',
  ended_at: null,
}

function client(answer: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => answer)
  const rpc = vi.fn(() => ({ maybeSingle }))
  return { supabase: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

describe('getMyReservation', () => {
  it('reads my_reservation for that id and names the columns for the pages', async () => {
    const { supabase, rpc } = client({ data: row, error: null })
    const reservation = await getMyReservation(supabase, id)

    expect(rpc).toHaveBeenCalledWith('my_reservation', { p_reservation_id: id })
    expect(reservation).toMatchObject({
      id,
      status: 'pending_payment',
      paymentStatus: 'pending',
      feeAmount: 5000,
      unitLabel: 'U1',
      zoneName: 'Open floor',
      waitWindowMinutes: 60,
      bookingToken: null,
      checkoutUrl: null,
    })
  })

  it('asks for the current hold when no id is given', async () => {
    const { supabase, rpc } = client({ data: row, error: null })
    await getMyReservation(supabase)
    expect(rpc).toHaveBeenCalledWith('my_reservation', {})
  })

  it('returns null for a malformed id, without asking the database', async () => {
    const { supabase, rpc } = client({ data: row, error: null })
    expect(await getMyReservation(supabase, 'not-a-uuid')).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("returns null for zero rows (another Seeker's hold) or an error", async () => {
    expect(
      await getMyReservation(client({ data: null, error: null }).supabase, id),
    ).toBeNull()
    expect(
      await getMyReservation(
        client({ data: null, error: { code: '42501' } }).supabase,
        id,
      ),
    ).toBeNull()
  })
})

describe('getHoldTerms', () => {
  const spaceId = 'e0000000-0000-4000-8000-000000000002'
  const termsRow = {
    fee_amount: 5000,
    payment_window_minutes: 10,
    max_wait_window_minutes: 60,
    is_open: true,
    next_closing_at: '2026-11-14T14:00:00+00:00',
    wait_window_minutes: [45, 15, 30],
  }

  it('reads hold_terms for the Space, with the wait windows shortest first', async () => {
    const { supabase, rpc } = client({ data: termsRow, error: null })
    expect(await getHoldTerms(supabase, spaceId)).toEqual({
      feeAmount: 5000,
      paymentWindowMinutes: 10,
      maxWaitWindowMinutes: 60,
      isOpen: true,
      nextClosingAt: '2026-11-14T14:00:00+00:00',
      waitWindowMinutes: [15, 30, 45],
    })
    expect(rpc).toHaveBeenCalledWith('hold_terms', { p_space_id: spaceId })
  })

  it('returns null for zero rows (a Space the caller may not see), an error or a bad id', async () => {
    expect(
      await getHoldTerms(client({ data: null, error: null }).supabase, spaceId),
    ).toBeNull()
    expect(
      await getHoldTerms(
        client({ data: null, error: { code: 'XX000' } }).supabase,
        spaceId,
      ),
    ).toBeNull()
    const { supabase, rpc } = client({ data: termsRow, error: null })
    expect(await getHoldTerms(supabase, 'nope')).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('getHoldViewer', () => {
  function viewerClient(user: { id: string } | null, role: string | null, hold: unknown) {
    const maybeSingleProfile = vi.fn(async () => ({
      data: role ? { role } : null,
      error: null,
    }))
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleProfile }) }),
    }))
    const rpc = vi.fn(() => ({ maybeSingle: async () => ({ data: hold, error: null }) }))
    const supabase = {
      auth: { getUser: async () => ({ data: { user } }) },
      from,
      rpc,
    } as unknown as SupabaseClient<Database>
    return { supabase, from, rpc }
  }

  it('is a signed-out visitor with no user', async () => {
    const { supabase, from } = viewerClient(null, null, null)
    expect(await getHoldViewer(supabase)).toEqual({ role: null, currentHold: null })
    expect(from).not.toHaveBeenCalled()
  })

  it("reads a Seeker's role from profiles, and their current hold", async () => {
    const { supabase, rpc } = viewerClient({ id: 'seeker' }, 'seeker', row)
    const viewer = await getHoldViewer(supabase)
    expect(viewer.role).toBe('seeker')
    expect(viewer.currentHold?.unitLabel).toBe('U1')
    expect(rpc).toHaveBeenCalledWith('my_reservation', {})
  })

  it('never looks up a hold for a Host or an Administrator', async () => {
    const { supabase, rpc } = viewerClient({ id: 'host' }, 'host', row)
    expect(await getHoldViewer(supabase)).toEqual({ role: 'host', currentHold: null })
    expect(rpc).not.toHaveBeenCalled()
  })
})
