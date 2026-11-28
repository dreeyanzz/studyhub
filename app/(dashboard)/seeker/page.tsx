import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Armchair,
  CheckCircle2,
  Compass,
  History,
  MapPin,
  Search,
  Star,
} from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { getReservationHistory } from '@/lib/data/history'
import { getMyReservation } from '@/lib/data/reservations'
import {
  getManilaMinutesFromDate,
  isSpaceOpenNow,
  searchVerifiedSpaces,
} from '@/lib/data/spaces'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

import { CurrentHoldCard } from './_components/current-hold-card'
import { FeaturedSpacesCard } from './_components/featured-spaces-card'
import { FindSpaceCard } from './_components/find-space-card'
import { ProfileForm } from './_components/profile-form'
import { ReservationHistoryCard } from './_components/reservation-history-card'
import { SeekerGuideCard } from './_components/seeker-guide-card'

type SearchParams = Record<string, string | string[] | undefined>

// A hold is a reservation that is still active (GLOSSARY).
const HOLD_STATUSES = new Set(['pending_payment', 'reserved', 'occupied'])

/**
 * SeekerPage component (STORY-04, STORY-09, STORY-10, STORY-16).
 * Server Component fetching user profile, active hold (`my_reservation()`),
 * recent reservation history (`my_reservation_history()`), and verified Spaces
 * to render a rich, actionable Seeker Dashboard.
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

  // Fetch active hold, recent history, and verified Spaces in parallel.
  const [hold, history, verifiedSpaces] = await Promise.all([
    getMyReservation(supabase, reservationId),
    getReservationHistory(supabase, { shown: 20 }),
    searchVerifiedSpaces(supabase, {}),
  ])

  const hasHold = hold !== null && HOLD_STATUSES.has(hold.status)
  const historyItems = history?.items ?? []
  const recentItems = historyItems.slice(0, 3)
  const completedCount = historyItems.filter(
    (item) => item.reservationStatus === 'completed',
  ).length
  const reviewedCount = historyItems.filter((item) => item.reviewId !== null).length

  const nowManilaMinutes = getManilaMinutesFromDate(new Date())
  const openNowCount = verifiedSpaces.filter((space) =>
    isSpaceOpenNow(space.opens_at, space.closes_at, nowManilaMinutes),
  ).length

  // Prioritize currently open Spaces first, then attach cover photos for top 4.
  const rankedSpaces = [...verifiedSpaces]
    .sort((a, b) => {
      const aOpen = isSpaceOpenNow(a.opens_at, a.closes_at, nowManilaMinutes) ? 1 : 0
      const bOpen = isSpaceOpenNow(b.opens_at, b.closes_at, nowManilaMinutes) ? 1 : 0
      if (aOpen !== bOpen) return bOpen - aOpen
      return (b.avg_overall ?? 0) - (a.avg_overall ?? 0)
    })
    .slice(0, 4)

  const featuredSpaces = await Promise.all(
    rankedSpaces.map(async (space) => {
      try {
        const { data: files } = await supabase.storage
          .from('space-photos')
          .list(space.id, {
            limit: 2,
            sortBy: { column: 'created_at', order: 'asc' },
          })
        const firstPhoto = (files ?? []).find((f) => f.name && !f.name.startsWith('.'))
        if (!firstPhoto) return { ...space, cover_photo_url: null }
        const coverUrl = supabase.storage
          .from('space-photos')
          .getPublicUrl(`${space.id}/${firstPhoto.name}`).data.publicUrl
        return { ...space, cover_photo_url: coverUrl }
      } catch {
        return { ...space, cover_photo_url: null }
      }
    }),
  )

  const firstName = profile.full_name?.trim().split(/\s+/)[0] || null

  const holdSnapshot = !hasHold
    ? { label: 'Ready to book', detail: 'No active seat hold' }
    : hold.status === 'pending_payment'
      ? {
          label: 'Payment due',
          detail: `Unit ${hold.unitLabel} · ${hold.spaceName}`,
        }
      : hold.status === 'occupied'
        ? {
            label: 'Checked in',
            detail: `Unit ${hold.unitLabel} · ${hold.spaceName}`,
          }
        : {
            label: 'Seat reserved',
            detail: `Unit ${hold.unitLabel} · ${hold.spaceName}`,
          }

  return (
    <div className="space-y-7">
      {/* 1. Command Header Bar with Personal Greeting & Quick Actions */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-6">
        <div className="min-w-0 space-y-2">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/85 px-3.5 py-1 text-xs font-semibold text-foreground shadow-2xs backdrop-blur-xs">
            <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
            <span>Seeker Portal{firstName ? ` · Welcome back, ${firstName}` : ''}</span>
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
            Seeker Dashboard
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Track your seat hold, explore verified study Spaces across Metro Cebu, and
            keep your profile ready for check-in.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/seeker/reservations"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-auto min-h-12 min-w-12 rounded-xl border-border bg-card px-4 py-2.5 font-semibold whitespace-normal shadow-2xs hover:border-primary/40 hover:bg-surface-subtle',
            )}
          >
            <History aria-hidden="true" className="size-4 text-primary" />
            <span>My reservations</span>
          </Link>
          <Link
            href="/spaces"
            className={cn(
              buttonVariants({ variant: 'default' }),
              'h-auto min-h-12 min-w-12 rounded-xl bg-gradient-to-r from-primary to-forest-mid px-5 py-2.5 font-semibold whitespace-normal text-white shadow-sm hover:from-primary-hover hover:to-forest-deep',
            )}
          >
            <Search aria-hidden="true" className="size-4" />
            <span>Explore map</span>
          </Link>
        </div>
      </header>

      {/* 2. 4-Card Luminous Real-Data Snapshot Strip */}
      <section
        aria-label="Account summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="flex min-w-0 items-center gap-3.5 rounded-3xl border border-border/80 bg-card p-5 shadow-card">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"
          >
            <Armchair className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">Seat status</p>
            <p className="truncate font-heading text-xl font-bold tracking-[-0.02em] text-foreground">
              {holdSnapshot.label}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {holdSnapshot.detail}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3.5 rounded-3xl border border-border/80 bg-card p-5 shadow-card">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"
          >
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">
              Completed visits
            </p>
            <p className="font-heading text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {completedCount}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {historyItems.length === 0
                ? 'Your first visit starts here'
                : `${historyItems.length}${history?.hasMore ? '+' : ''} total paid holds`}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3.5 rounded-3xl border border-border/80 bg-card p-5 shadow-card">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brass-soft text-brass-foreground"
          >
            <Star className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">Reviews shared</p>
            <p className="font-heading text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {reviewedCount}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {reviewedCount > 0 ? 'Helping fellow Seekers' : 'Rate after a visit'}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3.5 rounded-3xl border border-border/80 bg-card p-5 shadow-card">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"
          >
            {openNowCount > 0 ? (
              <Compass className="size-5" />
            ) : (
              <MapPin className="size-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">Verified Spaces</p>
            <p className="font-heading text-2xl font-bold tracking-tight text-primary tabular-nums">
              {verifiedSpaces.length}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {openNowCount} open right now
            </p>
          </div>
        </div>
      </section>

      {/* 3. Main Two-Column Luminous Bento Grid */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7.5fr)_minmax(0,4.5fr)]">
        <div className="min-w-0 space-y-6">
          <CurrentHoldCard
            hold={hold}
            showEnded={Boolean(reservationId)}
            confirmingCheckOut={confirmingCheckOut}
            checkOutError={checkOutError}
          />
          {!hasHold && <FindSpaceCard />}
          <FeaturedSpacesCard
            spaces={featuredSpaces}
            totalCount={verifiedSpaces.length}
            openNowCount={openNowCount}
          />
          <ReservationHistoryCard
            recentItems={recentItems}
            totalCount={historyItems.length}
            hasMore={history?.hasMore ?? false}
          />
        </div>

        <div className="min-w-0 space-y-6 lg:sticky lg:top-24">
          <ProfileForm profile={profile} email={user.email ?? null} />
          <SeekerGuideCard />
        </div>
      </div>
    </div>
  )
}
