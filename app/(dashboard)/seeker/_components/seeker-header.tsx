import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search } from 'lucide-react'

import { signOut } from '@/app/(auth)/actions'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

// An Administrator may open this portal too (D-032), so the badge shows the real role.
const roleLabels = { seeker: 'Seeker', host: 'Host', admin: 'Administrator' } as const

/**
 * SeekerHeader component (STORY-04, STORY-17).
 * Server Component rendering header shell with Worq branding, discovery link,
 * the signed-in user's full name, role badge, and a Log out button.
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
    <header className="border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            aria-label="Worq home"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'gap-2 px-2 font-heading text-xl font-semibold',
            )}
          >
            <svg
              width="28"
              height="28"
              viewBox="6 4 20 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="size-7 shrink-0"
            >
              <path
                d="M11 28 C11 26.2 13 25.5 16 25.5 C19 25.5 21 26.2 21 28 Z"
                fill="#173c2d"
              />
              <rect x="9.5" y="27.5" width="13" height="2" rx="1" fill="#b79248" />
              <path
                d="M16 25.5 L16 19 L12.5 12 L15 8"
                stroke="#b79248"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="19" r="1.4" fill="#b79248" />
              <rect x="14" y="5.5" width="4" height="2.6" rx="1" fill="#b79248" />
              <path
                d="M11 7.5 C11 6.7 21 6.7 21 7.5 L23.5 13.5 C23.7 14.2 23.1 14.6 22.3 14.6 L9.7 14.6 C8.9 14.6 8.3 14.2 8.5 13.5 Z"
                fill="#215c3f"
              />
              <path
                d="M9 14.3 H23"
                stroke="#e7cb83"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <line
                x1="21.5"
                y1="14.5"
                x2="21.5"
                y2="19.5"
                stroke="#b79248"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <circle cx="21.5" cy="20.5" r="1.4" fill="#b79248" />
            </svg>
            Worq
          </Link>
          <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold break-words text-foreground">
                  {displayName}
                </p>
                <Badge variant="secondary">{roleLabels[profile.role]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Seeker Portal</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/spaces"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'rounded-full px-4 text-sm',
            )}
          >
            <Search aria-hidden="true" className="size-4" /> Find a Space
          </Link>
          <form action={signOut}>
            <Button
              variant="ghost"
              size="default"
              type="submit"
              className="rounded-full px-4"
            >
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
