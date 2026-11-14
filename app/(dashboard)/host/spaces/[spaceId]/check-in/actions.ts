'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { bookingTokenSchema } from '@/lib/validation/check-in'
import { spaceIdSchema } from '@/lib/validation/space'

/**
 * Outcome returned by `checkInAction` matching STORY-10 design §3 (C1–C7).
 */
export type CheckInResult =
  | { outcome: 'success'; unitLabel: string; zoneName: string | null }
  | { outcome: 'wait_window_lapsed'; unitLabel: string | null }
  | { outcome: 'token_already_used' }
  | { outcome: 'reservation_cancelled' }
  | { outcome: 'wrong_space' }
  | { outcome: 'invalid_token' }
  | { outcome: 'forbidden' }
  | { outcome: 'error' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mapRpcError(code: string | undefined, hint: string | undefined): CheckInResult {
  if (code === '42501') {
    return { outcome: 'forbidden' }
  }
  if (code === 'P0001') {
    switch (hint) {
      case 'token_already_used':
        return { outcome: 'token_already_used' }
      case 'reservation_cancelled':
        return { outcome: 'reservation_cancelled' }
      case 'wrong_space':
        return { outcome: 'wrong_space' }
      case 'invalid_token':
      case 'invalid_state':
        return { outcome: 'invalid_token' }
      default:
        return { outcome: 'error' }
    }
  }
  return { outcome: 'error' }
}

/**
 * Host booking token check-in (STORY-10, TSK-10.4, FR-2.4, D-010, D-060).
 *
 * Normalizes and validates the token in application code, verifies an active session,
 * calls `public.check_in(p_token, p_space_id)`, and translates C1–C7 outcomes without
 * leaking Seeker identity (C-N4) or trusting client inputs.
 */
export async function checkInAction(
  spaceId: string,
  rawToken: string,
): Promise<CheckInResult> {
  const space = spaceIdSchema.safeParse(spaceId)
  if (!space.success) {
    return { outcome: 'error' }
  }

  const token = bookingTokenSchema.safeParse(rawToken)
  if (!token.success) {
    return { outcome: 'invalid_token' }
  }

  const checkInPath = `/host/spaces/${space.data}/check-in`
  const occupancyPath = `/host/spaces/${space.data}/occupancy`

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?returnUrl=${encodeURIComponent(checkInPath)}`)
  }

  const { data, error } = await supabase.rpc('check_in', {
    p_token: token.data,
    p_space_id: space.data,
  })

  if (error) {
    return mapRpcError(error.code, error.hint)
  }

  if (!isRecord(data) || typeof data.outcome !== 'string') {
    return { outcome: 'error' }
  }

  if (data.outcome === 'wait_window_lapsed') {
    revalidatePath(occupancyPath)
    revalidatePath(checkInPath)
    return {
      outcome: 'wait_window_lapsed',
      unitLabel: typeof data.unit_label === 'string' ? data.unit_label : null,
    }
  }

  if (data.outcome === 'success') {
    revalidatePath(occupancyPath)
    revalidatePath(checkInPath)
    return {
      outcome: 'success',
      unitLabel: typeof data.unit_label === 'string' ? data.unit_label : 'Unit',
      zoneName: typeof data.zone_name === 'string' ? data.zone_name : null,
    }
  }

  return { outcome: 'error' }
}
