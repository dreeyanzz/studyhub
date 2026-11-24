import { redirect } from 'next/navigation'

import { getMyReservation } from '@/lib/data/reservations'
import { createClient } from '@/lib/supabase/server'

import { CurrentHoldCard } from './_components/current-hold-card'
import { FindSpaceCard } from './_components/find-space-card'
import { ProfileForm } from './_components/profile-form'
import { ReservationHistoryCard } from './_components/reservation-history-card'

type SearchParams = Record<string, string | string[] | undefined>

// A hold is a reservation that is still active (GLOSSARY).
const HOLD_STATUSES = new Set(['pending_payment', 'reserved', 'occupied'])

/**
 * SeekerPage component (STORY-04, STORY-09, STORY-10).
 * Server Component fetching user profile data from Supabase Postgres profiles table
 * and rendering ProfileForm pre-filled with the signed-in user's details.
 * Displays the Seeker's active hold/visit (`my_reservation()`) or `?reservation=<id>` outcome
 * at the top (STORY-09/STORY-10 design §3), and a link to the discovery map while the
 * Seeker has no hold.
 */
export default async function SeekerPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const query = searchParams ? await searchParams : {}
  const reservationId =
    typeof query.reservation === 'string' ? query.reservation : undefined
  const confirmingCheckOut = query.checkout === '1'
  const checkOutError = query.error === 'check-out'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone_number')
    .eq('id', user.id)
    .maybeSingle()

  // Same as the header (TSK-04.2): without the Seeker's own row there is nothing to
  // show. The form never fills in invented values, which a Save would store as theirs.
  if (!profile) redirect('/login')

  // my_reservation records lapses first (D-047), so an expired hold shows its outcome.
  const hold = await getMyReservation(supabase, reservationId)
  const hasHold = hold !== null && HOLD_STATUSES.has(hold.status)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Seeker Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          See your hold, find a Space, and manage your profile details.
        </p>
      </div>

      <div className="max-w-2xl space-y-8">
        <CurrentHoldCard
          hold={hold}
          showEnded={Boolean(reservationId)}
          confirmingCheckOut={confirmingCheckOut}
          checkOutError={checkOutError}
        />
        {!hasHold && <FindSpaceCard />}
        <ReservationHistoryCard />
        <ProfileForm profile={profile} />
      </div>
    </div>
  )
}
