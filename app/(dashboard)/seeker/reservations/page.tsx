import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { getReservationHistory } from '@/lib/data/history'
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/seeker"
          className="inline-flex min-h-12 min-w-12 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Reservation history
        </h1>
        <p className="text-sm text-muted-foreground">
          Every reservation you paid for after it ended, newest first.
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
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
            className="space-y-4 rounded-xl border border-border bg-card p-6 text-center"
          >
            <div className="space-y-1">
              <h2
                id="empty-history-heading"
                className="text-lg font-semibold text-foreground"
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
                <HistoryRow key={item.reservationId} item={item} />
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
