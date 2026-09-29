import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './_components/profile-form'

/**
 * SeekerPage component (STORY-04).
 * Server Component fetching user profile data from Supabase Postgres profiles table
 * and rendering ProfileForm pre-filled with the signed-in user's details.
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Seeker Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile details and view upcoming feature updates.
        </p>
      </div>

      <div className="max-w-2xl">
        <ProfileForm profile={profile} />
      </div>
    </div>
  )
}
