import { redirect } from 'next/navigation'

import { getMyReservation } from '@/lib/data/reservations'
import { createClient } from '@/lib/supabase/server'

import { CurrentHoldCard } from './_components/current-hold-card'
import { PreviewCards } from './_components/preview-cards'
import { ProfileForm } from './_components/profile-form'

type SearchParams = Record<string, string | string[] | undefined>

/**
 * SeekerPage component (STORY-04, STORY-09, STORY-10).
 * Server Component fetching user profile data from Supabase Postgres profiles table
 * and rendering ProfileForm pre-filled with the signed-in user's details, plus PreviewCards.
 * Displays the Seeker's active hold/visit (`my_reservation()`) or `?reservation=<id>` outcome
 * at the top (STORY-09/STORY-10 design §3).
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Seeker Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile details and view upcoming feature updates.
        </p>
      </div>

      <div className="max-w-2xl space-y-8">
        <CurrentHoldCard
          hold={hold}
          showEnded={Boolean(reservationId)}
          confirmingCheckOut={confirmingCheckOut}
          checkOutError={checkOutError}
        />
        <ProfileForm profile={profile} />
        <PreviewCards />
      </div>
    </div>
  )
}
