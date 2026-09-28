import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * SeekerHeader component (STORY-04).
 * Server Component rendering header shell with Seeker's full name,
 * 'seeker' role badge, and Log out trigger button.
 */
export async function SeekerHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Read full_name from metadata or fallback to synthetic name per Rule D-013
  const fullName = (user?.user_metadata?.full_name as string | undefined) || 'Alex Seeker'

  return (
    <header className="border-b border-border bg-card px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{fullName}</h1>
              <Badge variant="secondary" className="capitalize">
                seeker
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Seeker Portal Dashboard</p>
          </div>
        </div>

        <form action="/api/auth/signout" method="POST">
          <Button variant="outline" size="default" type="submit">
            Log out
          </Button>
        </form>
      </div>
    </header>
  )
}
