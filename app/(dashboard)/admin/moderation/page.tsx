import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
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
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Review Moderation
          </h1>
          <p className="text-sm text-muted-foreground">
            Review reported content, restore hidden reviews, or remove them permanently.
          </p>
        </div>

        <nav aria-label="Review moderation lists" className="flex flex-wrap gap-2">
          {LIST_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/moderation?list=${tab.value}`}
              aria-current={list === tab.value ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: list === tab.value ? 'default' : 'outline' }),
                'h-auto min-h-12 min-w-12 py-2 whitespace-normal',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <Alert variant="destructive" role="alert" data-testid="moderation-load-error">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertTitle>Error loading moderation queue</AlertTitle>
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

  return (
    <ModerationQueue
      items={queue.items}
      historyByReviewId={historyByReviewId}
      list={list}
      shown={show}
      hasMore={queue.hasMore}
    />
  )
}
