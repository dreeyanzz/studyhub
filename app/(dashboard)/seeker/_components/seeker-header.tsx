import { redirect } from 'next/navigation'

import { signOut } from '@/app/(auth)/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

// An Administrator may open this portal too (D-032), so the badge shows the real role.
const roleLabels = { seeker: 'Seeker', host: 'Host', admin: 'Administrator' } as const

/**
 * SeekerHeader component (STORY-04).
 * Server Component rendering header shell with the signed-in user's full name,
 * role badge, and a Log out button that calls STORY-03's signOut Server Action.
 */
export async function SeekerHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // proxy.ts already sends visitors who are not signed in to /login; this is a backstop.
  if (!user) redirect('/login?returnUrl=%2Fseeker')

  // The name comes from the user's own profiles row, which the profile form edits
  // (STORY-04 design §1), never from user_metadata.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) redirect('/login')
  // Sign-up always sets full_name; an account made another way may have none.
  const displayName = profile.full_name || user.email || 'Your account'

  return (
    <header className="border-b border-border bg-card px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold break-words text-foreground">
                {displayName}
              </p>
              <Badge variant="secondary">{roleLabels[profile.role]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Seeker Portal Dashboard</p>
          </div>
        </div>

        <form action={signOut}>
          <Button variant="outline" size="default" type="submit">
            Log out
          </Button>
        </form>
      </div>
    </header>
  )
}
