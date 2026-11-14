import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'

import { getMyReservation } from './reservations'

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
