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
    .select('full_name, phone_number, role')
    .eq('id', user.id)
    .single()

  const userProfile = {
    full_name: profile?.full_name || 'Alex Seeker',
    phone_number: profile?.phone_number || null,
  }

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
        <ProfileForm profile={userProfile} />
      </div>
    </div>
  )
}
