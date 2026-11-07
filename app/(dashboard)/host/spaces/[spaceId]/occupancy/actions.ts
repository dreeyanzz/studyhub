'use server'

// Server Action for the Host's occupancy controls (STORY-12 design §2 and §3, D-010).
// An action can be called directly, so it checks its own input and session.
// public.set_unit_state is the security boundary: it refuses anyone but the Space's
// Host (N13).
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { mapRefusalError } from '@/lib/occupancy/override'
import { createClient } from '@/lib/supabase/server'
import { setUnitStateSchema, type SetUnitStateInput } from '@/lib/validation/occupancy'
import { spaceIdSchema } from '@/lib/validation/space'

export type SetUnitStateResult =
  | { success: true }
  | {
      success: false
      // One of design §3's messages, never a Supabase error.
      error: string
      // N14 and N21: the hold the Host saw has changed, so the UI offers a refresh.
      canRefresh: boolean
    }

export async function setUnitStateAction(
  spaceId: string,
  input: SetUnitStateInput,
): Promise<SetUnitStateResult> {
  const space = spaceIdSchema.safeParse(spaceId)
  if (!space.success) {
    // spaceIdSchema's one message, "We could not find that Space."
    const error = z.flattenError(space.error).formErrors.join(' ')
    return { success: false, error, canRefresh: false }
  }
  const parsed = setUnitStateSchema.safeParse(input)
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? 'Invalid unit state input.'
    return { success: false, error, canRefresh: false }
  }

  const occupancyPath = `/host/spaces/${space.data}/occupancy`
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(occupancyPath)}`)

  const { unitId, state, expectedReservationId, expectedReservationStatus } = parsed.data
  const { error } = await supabase.rpc('set_unit_state', {
    p_unit_id: unitId,
    p_state: state,
    p_expected_reservation_id: expectedReservationId ?? undefined,
    p_expected_reservation_status: expectedReservationStatus ?? undefined,
  })
  if (error) {
    // Design §2: refusals are told apart by code and hint, never by message text.
    const holdMoved =
      error.code === 'P0001' &&
      (error.hint === 'hold_not_named' || error.hint === 'hold_changed')
    return {
      success: false,
      error: mapRefusalError(error.code, error.hint),
      canRefresh: holdMoved,
    }
  }

  revalidatePath(occupancyPath)
  return { success: true }
}
