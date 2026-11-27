import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'

import {
  EditorialInteractive,
  EditorialReveal,
  EditorialStagger,
  EditorialStaggerItem,
} from '@/components/motion/editorial-motion'

import { HostDeskPreview } from './_components/host-desk-preview'

export const metadata: Metadata = {
  title: 'For Hosts',
  description:
    'List your study or co-working Space on Worq. Publish a snap-grid Seat map, keep walk-in availability current in one tap, and verify check-ins with QR.',
}

const ONBOARDING_STEPS = [
  {
    number: '01',
    title: 'Create your Space',
    text: 'Sign up as a Host and enter your Space name, Metro Cebu map pin, address, operating hours, price tier, and maximum wait window.',
  },
  {
    number: '02',
    title: 'Build your Seat map',
    text: 'Arrange seats, standing desks, and group study rooms on a 6-column snap grid by Zone, upload photos, and select curated amenity tags.',
  },
  {
    number: '03',
    title: 'Get Verified',
    text: 'An Administrator reviews your Space details before it appears publicly so Seekers can trust every pin on the discovery map.',
  },
  {
    number: '04',
    title: 'Welcome Seekers',
    text: 'Toggle walk-in occupancy in one tap and scan or enter each Seeker’s booking token at arrival to mark them Checked in.',
  },
] as const

const HOST_FAQ = [
  {
    question: 'Do I need occupancy sensors or special hardware?',
    answer:
      'No. Worq runs in any phone or desktop browser at your front desk. You update walk-in Units in one tap, and every public Space displays an honest Host-updated timestamp.',
  },
  {
    question: 'What happens when a Seeker does not show up?',
    answer:
      'Seekers pick a wait window within the maximum limit you set. If they do not check in before that wait window lapses, the Unit returns to Available automatically and the reservation fee is forfeited.',
  },
  {
    question: 'How do reservation fees work right now?',
    answer:
      'Reservation fees currently run through Stripe sandbox test mode, so no real money is charged or transferred during course demos.',
  },
  {
    question: 'Why do new Spaces start as Pending verification?',
    answer:
      'Every new Space—and edits to a Verified Space’s name, address, or map pin—goes through an Administrator review so Seekers only discover legitimate Spaces.',
  },
] as const

export default function ForHostsPage() {
  return (
    <div className="bg-background wrap-anywhere text-foreground">
      {/* Section 1: Split Editorial Host Hero */}
      <section
        aria-labelledby="hosts-hero-title"
        className="border-b border-border bg-background"
      >
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:gap-12 lg:px-10 lg:py-20">
          <div className="space-y-6 lg:col-span-7">
            <EditorialReveal immediate y={10}>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-primary" aria-hidden="true" />
                <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                  For study &amp; co-working Hosts · Metro Cebu
                </p>
              </div>
            </EditorialReveal>

            <EditorialReveal immediate delay={0.07} y={14}>
              <h1
                id="hosts-hero-title"
                className="max-w-[16ch] font-heading text-4xl leading-[1.06] font-normal tracking-[-0.03em] text-balance text-foreground sm:text-5xl lg:text-[3.5rem]"
              >
                Your Space, mapped{' '}
                <em className="font-normal text-primary italic">for focused work.</em>
              </h1>
            </EditorialReveal>

            <EditorialReveal immediate delay={0.13} y={12}>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Turn empty desks into reliable Visits. Publish a 6-column Seat map, update
                walk-in occupancy in one tap, and verify Seeker holds at your front desk
                with QR check-in.
              </p>
            </EditorialReveal>

            <EditorialReveal immediate delay={0.19} y={10}>
              <div className="flex flex-wrap items-center gap-3">
                <EditorialInteractive lift={-1.5}>
                  <Link
                    href="/register?role=host"
                    className="group inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Become a Host
                    <ArrowRight
                      className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </EditorialInteractive>
                <EditorialInteractive lift={-1.5}>
                  <Link
                    href="/login"
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold whitespace-normal text-foreground transition-colors hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Host sign in
                  </Link>
                </EditorialInteractive>
              </div>
            </EditorialReveal>

            <EditorialReveal immediate delay={0.24} y={8}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-5">
                <Link
                  href="/spaces"
                  className="group inline-flex min-h-12 min-w-12 items-center gap-1.5 text-sm font-semibold whitespace-normal text-primary underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  See Verified Spaces on the map
                  <ArrowRight
                    className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
                {/* Honest about verification (D-037) and sandbox payments (D-005). */}
                <p className="text-sm text-muted-foreground">
                  Reviewed by an Administrator before going public. Reservation fees run
                  in sandbox mode, so no real money moves.
                </p>
              </div>
            </EditorialReveal>
          </div>

          <EditorialReveal immediate delay={0.12} y={18} className="lg:col-span-5">
            <figure className="rounded-2xl border border-border bg-card p-3 shadow-[0_24px_48px_-32px_rgba(23,60,45,0.32)]">
              <div className="overflow-hidden rounded-xl bg-secondary">
                <Image
                  src="/images/public-landing/library.webp"
                  alt="Rows of study desks inside a quiet, well-lit reading room"
                  width={1600}
                  height={1067}
                  sizes="(min-width: 64rem) 40vw, 100vw"
                  loading="eager"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 hover:scale-[1.02] lg:aspect-[4/5]"
                />
              </div>
              <figcaption className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3">
                <div className="space-y-0.5">
                  <p className="font-mono text-xs font-semibold tracking-wider text-primary uppercase">
                    Host Portal · Zero extra hardware
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Build your Seat map and run check-ins from any phone or desktop
                    browser.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-xs font-medium text-foreground">
                  <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                  Verified Spaces
                </span>
              </figcaption>
            </figure>
          </EditorialReveal>
        </div>
      </section>

      {/* Section 2: Interactive Host Front-Desk Preview */}
      <section aria-labelledby="host-desk-title" className="py-16 lg:py-24">
        <div className="mx-auto w-full max-w-7xl space-y-12 px-4 sm:px-6 lg:px-10">
          <EditorialReveal className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-7">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                01 / The Host portal
              </p>
              <h2
                id="host-desk-title"
                className="max-w-[20ch] font-heading text-3xl leading-[1.12] font-normal tracking-[-0.02em] text-balance text-foreground sm:text-4xl"
              >
                Run your floor without extra hardware.
              </h2>
            </div>
            <p className="text-base leading-relaxed text-muted-foreground lg:col-span-5">
              Worq pairs automatic Seeker holds with fast manual overrides for walk-ins.
              Try toggling a walk-in seat or verifying a booking token below.
            </p>
          </EditorialReveal>

          <EditorialReveal delay={0.08}>
            <HostDeskPreview />
          </EditorialReveal>
        </div>
      </section>

      {/* Section 3: 4-Stage Host Onboarding Rail */}
      <section
        aria-labelledby="host-onboarding-title"
        className="border-y border-border bg-muted/60 py-16 lg:py-24"
      >
        <div className="mx-auto w-full max-w-7xl space-y-12 px-4 sm:px-6 lg:px-10">
          <EditorialReveal className="space-y-3">
            <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
              02 / From sign-up to Verified
            </p>
            <h2
              id="host-onboarding-title"
              className="max-w-[24ch] font-heading text-3xl leading-[1.12] font-normal tracking-[-0.02em] text-balance text-foreground sm:text-4xl"
            >
              Four steps to welcome your first Seeker.
            </h2>
          </EditorialReveal>

          <EditorialStagger
            as="ol"
            stagger={0.08}
            className="grid grid-cols-1 gap-8 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0"
          >
            {ONBOARDING_STEPS.map((step, index) => (
              <EditorialStaggerItem
                key={step.number}
                as="li"
                className={
                  index > 0
                    ? 'space-y-2.5 border-t border-border pt-6 sm:border-t-0 sm:pt-0 lg:border-l lg:pl-7'
                    : 'space-y-2.5 lg:pr-7'
                }
              >
                <span
                  aria-hidden="true"
                  className="block font-heading text-3xl text-primary"
                >
                  {step.number}
                </span>
                <h3 className="font-heading text-xl font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </EditorialStaggerItem>
            ))}
          </EditorialStagger>
        </div>
      </section>

      {/* Section 4: Honest Host Ground Rules / FAQ */}
      <section aria-labelledby="host-faq-title" className="py-16 lg:py-24">
        <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:px-6 lg:px-10">
          <EditorialReveal className="space-y-3">
            <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
              03 / Ground rules
            </p>
            <h2
              id="host-faq-title"
              className="max-w-[22ch] font-heading text-3xl leading-[1.12] font-normal tracking-[-0.02em] text-balance text-foreground sm:text-4xl"
            >
              Straight answers before you list.
            </h2>
          </EditorialReveal>

          <EditorialStagger
            as="dl"
            stagger={0.07}
            className="grid grid-cols-1 gap-8 border-t border-border pt-8 md:grid-cols-2 md:gap-x-12 md:gap-y-10"
          >
            {HOST_FAQ.map((item) => (
              <EditorialStaggerItem key={item.question} className="space-y-2.5">
                <dt className="font-heading text-xl font-semibold text-foreground">
                  {item.question}
                </dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </dd>
              </EditorialStaggerItem>
            ))}
          </EditorialStagger>
        </div>
      </section>

      {/* Section 5: Deep-Forest Closing Host CTA Band */}
      <section
        aria-labelledby="hosts-cta-title"
        className="bg-foreground py-16 text-background lg:py-20"
      >
        <EditorialReveal className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-10">
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-xs font-semibold tracking-widest text-[#f0c95c] uppercase">
              Ready to host
            </p>
            <h2
              id="hosts-cta-title"
              className="font-heading text-3xl leading-[1.12] font-normal tracking-[-0.02em] text-balance sm:text-4xl"
            >
              Put your study Space on the Metro Cebu map.
            </h2>
            <p className="text-sm leading-relaxed text-background/85 sm:text-base">
              Set up your Space, map your Zones, and submit for Administrator verification
              in minutes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <EditorialInteractive lift={-1.5}>
              <Link
                href="/register?role=host"
                className="group inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
              >
                Create your Host account
                <ArrowRight
                  className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </EditorialInteractive>
            <EditorialInteractive lift={-1.5}>
              <Link
                href="/spaces"
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-background/45 px-5 py-3 text-sm font-semibold whitespace-normal text-background transition-colors hover:bg-background/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-background"
              >
                Explore Seeker map
              </Link>
            </EditorialInteractive>
          </div>
        </EditorialReveal>
      </section>
    </div>
  )
}
