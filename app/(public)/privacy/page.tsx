import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Worq handles account, Google sign-in, and reservation data.',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 lg:py-16">
      <div className="space-y-3 border-b border-border/80 pb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          Privacy &amp; Data Protection
        </span>
        <h1 className="font-heading text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          Last updated: November 24, 2026
        </p>
      </div>

      <div className="divide-y divide-border/80 rounded-3xl border border-border/80 bg-card shadow-card">
        <section className="space-y-3 p-6 sm:p-8">
          <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            01
          </p>
          <h2 className="font-heading text-2xl font-medium text-foreground">
            1. What Worq collects
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Worq is a study and co-working seat discovery and reserve-now web application.
            When you create an account using email and password or{' '}
            <strong className="font-medium text-foreground">Continue with Google</strong>,
            we collect only your email address, display name, and the account role you
            choose (Seeker or Host). You may optionally add a phone number in your
            profile.
          </p>
        </section>

        <section className="space-y-3 p-6 sm:p-8">
          <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            02
          </p>
          <h2 className="font-heading text-2xl font-medium text-foreground">
            2. Google sign-in scope
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            When you sign in with Google, Worq requests only standard basic profile scopes
            (
            <code className="rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-sm text-foreground">
              openid
            </code>
            ,{' '}
            <code className="rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-sm text-foreground">
              email
            </code>
            , and{' '}
            <code className="rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-sm text-foreground">
              profile
            </code>
            ) through Supabase Auth to verify your identity and pre-fill your display
            name. Worq never requests access to your Gmail messages, contacts, calendar,
            or Google Drive files.
          </p>
        </section>

        <section className="space-y-3 p-6 sm:p-8">
          <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            03
          </p>
          <h2 className="font-heading text-2xl font-medium text-foreground">
            3. How your data is used and protected
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Your account profile, Space listings, seat holds, check-ins, and reviews are
            stored in Supabase Postgres protected by Row-Level Security so only you (and
            platform Administrators where moderation requires it) can access private
            account records. Reservation fees run in Stripe sandbox test mode; Worq does
            not process real payment cards or move real money.
          </p>
        </section>

        <section className="space-y-3 p-6 sm:p-8">
          <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            04
          </p>
          <h2 className="font-heading text-2xl font-medium text-foreground">
            4. Contact
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Questions or account deletion requests can be sent to the Worq team by email:
          </p>
          <div>
            <a
              href="mailto:worq.team.ph@gmail.com"
              className={buttonVariants({
                variant: 'link',
                className:
                  'h-auto min-h-12 justify-start px-0 py-2 text-left font-medium break-all whitespace-normal',
              })}
            >
              worq.team.ph@gmail.com
            </a>
          </div>
        </section>
      </div>

      <div className="pt-1">
        <Link
          href="/"
          className={buttonVariants({
            variant: 'outline',
            className: 'rounded-xl px-5',
          })}
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </div>
  )
}
