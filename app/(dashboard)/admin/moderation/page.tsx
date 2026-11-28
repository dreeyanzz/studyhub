import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { dashboardFor } from '@/lib/auth/role-guard'
import {
  getModerationHistory,
  getReviewQueue,
  type ModerationEventItem,
} from '@/lib/data/admin'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { reviewQueueSchema, type ReviewQueueList } from '@/lib/validation/admin'
import { ModerationQueue } from './_components/moderation-queue'

export const metadata: Metadata = {
  title: 'Review Moderation',
}

const LIST_TABS: ReadonlyArray<{ value: ReviewQueueList; label: string }> = [
  { value: 'reported', label: 'Reported' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'removed', label: 'Removed' },
]

interface AdminModerationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Administration Review Moderation page (`/admin/moderation`, STORY-14 design §3
 * Screen 2, TSK-14.3, FR-5.2, D-080).
 *
 * Enforces the Administrator role check (matching `/admin`), parses `?list=` and
 * `?show=` via `reviewQueueSchema`, and loads the queue + each shown review's
 * moderation log history.
 */
export default async function AdminModerationPage({
  searchParams,
}: AdminModerationPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnUrl=%2Fadmin%2Fmoderation')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') {
    redirect(profile ? dashboardFor(profile.role) : '/login')
  }

  const rawParams = await searchParams
  const { list, show } = reviewQueueSchema.parse(rawParams)

  const queue = await getReviewQueue(supabase, { list, shown: show })
  const historyMap = queue
    ? await getModerationHistory(
        supabase,
        queue.items.map((item) => item.reviewId),
      )
    : null

  if (!queue || !historyMap) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5 border-b border-border/80 pb-5">
          <p className="inline-block rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
            Administration · Moderation
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
            Review Moderation
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Review reported content, restore hidden reviews, or remove them permanently.
          </p>
        </div>

        <nav aria-label="Review moderation lists" className="flex flex-wrap gap-2">
          {LIST_TABS.map((tab) => {
            const active = list === tab.value
            return (
              <Link
                key={tab.value}
                href={`/admin/moderation?list=${tab.value}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border px-5 py-2 text-sm font-semibold whitespace-normal transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border/80 bg-card text-foreground hover:border-primary/45 hover:bg-surface-subtle',
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <Alert
          variant="destructive"
          role="alert"
          data-testid="moderation-load-error"
          className="rounded-2xl border-destructive/30 shadow-xs"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertTitle className="font-semibold">
            Error loading moderation queue
          </AlertTitle>
          <AlertDescription>
            We couldn&apos;t load the moderation queue. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const historyByReviewId: Record<string, ModerationEventItem[]> = {}
  for (const [reviewId, events] of historyMap.entries()) {
    historyByReviewId[reviewId] = events
  }

  // key={list}: a list change starts the queue afresh, so a message about a review on
  // one list never shows on another.
  return (
    <ModerationQueue
      key={list}
      items={queue.items}
      historyByReviewId={historyByReviewId}
      list={list}
      shown={show}
      hasMore={queue.hasMore}
    />
  )
}
