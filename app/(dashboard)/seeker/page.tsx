import { redirect } from 'next/navigation'

import { getMyReservation } from '@/lib/data/reservations'
import { createClient } from '@/lib/supabase/server'

import { CurrentHoldCard } from './_components/current-hold-card'

import { PreviewCards } from './_components/preview-cards'
import { ProfileForm } from './_components/profile-form'

/**
 * SeekerPage component (STORY-04).
 * Server Component fetching user profile data from Supabase Postgres profiles table
 * and rendering ProfileForm pre-filled with the signed-in user's details, plus PreviewCards.
 * While the Seeker has a hold, the "Your hold" card comes first (STORY-09 design §3).
 */
export default async function SeekerPage() {
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

  // With no id, my_reservation returns the Seeker's current hold, lapses recorded first.
  const hold = await getMyReservation(supabase)

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
        <CurrentHoldCard hold={hold} />
        <ProfileForm profile={profile} />
        <PreviewCards />
      </div>
    </div>
  )
}
