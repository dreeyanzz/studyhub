'use server'

// "Hold this unit" on the Space profile (STORY-09 design §3, TSK-09.6, R1, D-068).
// An action can be called directly, so it checks its own input and session.
// public.hold_unit is the security boundary: it refuses anyone but a Seeker (N5) and
// every unit that can't be held (N1 to N4).
import { redirect } from 'next/navigation'

import { holdRefusalReason } from '@/lib/payments/refusals'
import { createClient } from '@/lib/supabase/server'
import { holdUnitSchema } from '@/lib/validation/reservation'
import { spaceIdSchema } from '@/lib/validation/space'

export async function holdUnit(formData: FormData): Promise<void> {
  const space = spaceIdSchema.safeParse(formData.get('spaceId'))
  if (!space.success) redirect('/spaces')
  const profilePath = `/spaces/${space.data}`

  const parsed = holdUnitSchema.safeParse({
    spaceId: space.data,
    unitId: formData.get('unitId'),
    waitWindowMinutes: formData.get('waitWindowMinutes'),
  })
  if (!parsed.success) redirect(`${profilePath}?refused=error`)
  const { unitId, waitWindowMinutes } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Back to the profile, with no unit chosen: the Seeker picks again (D-058).
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(profilePath)}`)

  const { data, error } = await supabase
    .rpc('hold_unit', { p_unit_id: unitId, p_wait_window_minutes: waitWindowMinutes })
    .maybeSingle()

  if (error || !data) {
    // Back to the same unit, so the profile rereads availability and shows the unit as
    // it is now, with the refusal's message above it (seeker-hold-stale-unit-refresh).
    // The reason, never a database message, goes in the URL. A message kept in the
    // panel would go with it, because the seat map hides the panel once the unit
    // isn't Available.
    const reason = holdRefusalReason(error?.code, error?.hint)
    redirect(`${profilePath}?unit=${encodeURIComponent(unitId)}&refused=${reason}`)
  }

  // A new hold, or the same hold again after a double tap (W2): its page either way.
  redirect(`/seeker/reservations/${data.reservation_id}`)
}
