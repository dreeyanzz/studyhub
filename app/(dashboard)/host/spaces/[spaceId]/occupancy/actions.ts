'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { mapRefusalError } from '@/lib/occupancy/override'
import { createClient } from '@/lib/supabase/server'
import { setUnitStateSchema, type SetUnitStateInput } from '@/lib/validation/occupancy'

export type SetUnitStateResult =
  | { success: true; error?: never }
  | { success: false; error: string; code?: string | null }

/**
 * Server Action for Host live occupancy control (STORY-12 design §2, §3, TSK-12.3).
 *
 * Validates inputs with setUnitStateSchema, verifies the Host session,
 * invokes Postgres stored procedure public.set_unit_state, maps database
 * refusals (42501 -> N13, P0001/hold_not_named -> N14, P0001/hold_changed -> N21),
 * and triggers Next.js revalidation for the occupancy view.
 */
export async function setUnitStateAction(
  spaceIdOrInput: string | SetUnitStateInput | unknown,
  maybeInput?: SetUnitStateInput | unknown,
): Promise<SetUnitStateResult> {
  const isFirstArgSpaceId = typeof spaceIdOrInput === 'string'
  const spaceId = isFirstArgSpaceId ? spaceIdOrInput : ''
  const rawInput = isFirstArgSpaceId ? maybeInput : spaceIdOrInput

  const parsed = setUnitStateSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      success: false,
      error: firstIssue?.message ?? 'Invalid unit state input.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const returnUrl = spaceId ? `/host/spaces/${spaceId}/occupancy` : '/host'
    redirect(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
  }

  const { unitId, state, expectedReservationId, expectedReservationStatus } = parsed.data

  const { error } = await supabase.rpc('set_unit_state', {
    p_unit_id: unitId,
    p_state: state,
    p_expected_reservation_id: expectedReservationId ?? undefined,
    p_expected_reservation_status: expectedReservationStatus ?? undefined,
  })

  if (error) {
    const userMessage = mapRefusalError(error.code, error.hint)
    return {
      success: false,
      error: userMessage,
      code: error.code ?? null,
    }
  }

  if (spaceId) {
    revalidatePath(`/host/spaces/${spaceId}/occupancy`)
  }

  return { success: true }
}
