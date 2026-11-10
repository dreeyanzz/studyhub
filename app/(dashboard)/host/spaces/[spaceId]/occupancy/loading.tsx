import { Card, CardContent, CardHeader } from '@/components/ui/card'

/**
 * Server Component loading skeleton for the Host Occupancy screen (STORY-12 design §3).
 *
 * Provides a screen-reader accessible loading announcement and pulsing visual skeletons.
 */
export default function OccupancyLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading space occupancy...</span>

      {/* Header Skeleton. The placeholders may wrap and shrink, like the header they
          stand for, so they fit a 360 px screen at 200% text (design §3). */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="h-12 w-36 max-w-full animate-pulse rounded-md bg-muted" />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="h-7 w-32 max-w-full animate-pulse rounded-full bg-muted" />
            <div className="h-7 w-40 max-w-full animate-pulse rounded-full bg-muted" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-8 w-64 max-w-full animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      {/* View Toggle Skeleton */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-12 w-36 max-w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-32 max-w-full animate-pulse rounded-md bg-muted" />
      </div>

      {/* Layout Grid Skeleton */}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-md border border-border bg-muted/40"
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-12 w-full animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-12 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-12 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-12 flex-1 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
