import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { getMyHistoryReviewValues, getReservationHistory } from '@/lib/data/history'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { historyPageSchema } from '@/lib/validation/history'

import { buttonLinkClass } from './[id]/_components/reservation-status-view'
import { HistoryRow } from './_components/history-row'

export const metadata: Metadata = {
  title: 'Reservation History',
}

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Seeker reservation history page (STORY-16 design §3).
 * Server Component reading the caller's paid, ended reservations via `my_reservation_history`.
 * Supports incremental loading via `?show=20|40|60|80|100`.
 */
export default async function ReservationHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const query = searchParams ? await searchParams : {}
  const { show } = historyPageSchema.parse(query)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?returnUrl=%2Fseeker%2Freservations')
  }

  const history = await getReservationHistory(supabase, { shown: show })

  // Edit your review opens prefilled (design §3 Screen 4), so read the current values of
  // the visible reviews on the rows shown. If that read fails, those rows still say
  // "Reviewed" and simply offer no Edit button.
  const visibleReviewIds = (history?.items ?? [])
    .filter((item) => item.reviewStatus === 'visible' && item.reviewId !== null)
    .map((item) => item.reviewId as string)
  const reviewValues =
    visibleReviewIds.length > 0
      ? await getMyHistoryReviewValues(supabase, user.id, visibleReviewIds)
      : null

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            href="/seeker"
            className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-full border border-border/80 bg-card px-4 text-sm font-medium text-foreground shadow-2xs transition-colors hover:border-primary/45 hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span>Back to dashboard</span>
          </Link>
        </nav>
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight wrap-anywhere text-foreground sm:text-4xl">
            Reservation history
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Every reservation you paid for after it ended, newest first.
          </p>
        </div>
      </div>

      <div className="max-w-3xl space-y-4">
        {history === null ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              We couldn&apos;t load your reservation history. Refresh the page to try
              again.
            </AlertDescription>
          </Alert>
        ) : history.items.length === 0 ? (
          <section
            aria-labelledby="empty-history-heading"
            className="space-y-4 rounded-3xl border border-dashed border-border bg-surface-subtle/75 p-8 text-center shadow-card"
          >
            <div className="space-y-1">
              <h2
                id="empty-history-heading"
                className="font-heading text-xl font-semibold text-foreground"
              >
                No past reservations yet
              </h2>
              <p className="text-sm text-muted-foreground">
                Your completed, cancelled, and refunded holds will appear here.
              </p>
            </div>
            <div>
              <Link href="/spaces" className={buttonLinkClass()}>
                <Search aria-hidden="true" className="size-4" />
                Find a Space
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="space-y-4">
              {history.items.map((item) => (
                <HistoryRow
                  key={item.reservationId}
                  item={item}
                  reviewValues={
                    item.reviewId ? (reviewValues?.get(item.reviewId) ?? null) : null
                  }
                />
              ))}
            </div>

            {history.hasMore && show < 100 && (
              <div className="pt-2 text-center">
                <Link
                  href={`/seeker/reservations?show=${show + 20}`}
                  className={cn(buttonLinkClass('outline'), 'w-full sm:w-auto')}
                >
                  Show more
                </Link>
              </div>
            )}

            {history.hasMore && show >= 100 && (
              <p className="pt-2 text-center text-sm text-muted-foreground">
                Showing your newest 100 past reservations.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
