import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Worq handles account, Google sign-in, and reservation data.',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground">Last updated: November 24, 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">1. What Worq collects</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          Worq is a study and co-working seat discovery and reserve-now web application.
          When you create an account using email and password or{' '}
          <strong className="font-medium text-foreground">Continue with Google</strong>,
          we collect only your email address, display name, and the account role you
          choose (Seeker or Host). You may optionally add a phone number in your profile.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">2. Google sign-in scope</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          When you sign in with Google, Worq requests only standard basic profile scopes (
          <code>openid</code>, <code>email</code>, and <code>profile</code>) through
          Supabase Auth to verify your identity and pre-fill your display name. Worq never
          requests access to your Gmail messages, contacts, calendar, or Google Drive
          files.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          3. How your data is used and protected
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          Your account profile, Space listings, seat holds, check-ins, and reviews are
          stored in Supabase Postgres protected by Row-Level Security so only you (and
          platform Administrators where moderation requires it) can access private account
          records. Reservation fees run in Stripe sandbox test mode; Worq does not process
          real payment cards or move real money.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">4. Contact</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          Questions or account deletion requests can be sent to the Worq team by email:
        </p>
        <div>
          <a
            href="mailto:worq.team.ph@gmail.com"
            className={buttonVariants({
              variant: 'link',
              className:
                'h-auto min-h-12 justify-start px-0 py-3 text-left break-all whitespace-normal',
            })}
          >
            worq.team.ph@gmail.com
          </a>
        </div>
      </section>

      <div>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Back to home
        </Link>
      </div>
    </div>
  )
}
