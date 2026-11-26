import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

/**
 * Loading state for the Administration verification queue (STORY-15 design §3).
 * Renders accessible card placeholder skeletons with subtle pulsing backgrounds
 * while the queue data loads from Supabase.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Space Verification
        </h1>
        <p className="text-sm text-muted-foreground">
          Review Pending Spaces, inspect changes, take Verified Spaces down, or undo past
          decisions.
        </p>
      </div>

      {/* Metric skeleton */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[1, 2, 3].map((id) => (
          <div
            key={id}
            className="flex animate-pulse items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs"
          >
            <div className="size-11 rounded-xl bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-5 w-28 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((placeholderId) => (
          <Card
            key={placeholderId}
            className="animate-pulse overflow-hidden rounded-2xl border-border/70 bg-card shadow-xs"
          >
            <CardHeader className="space-y-2 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="h-6 w-48 rounded-lg bg-muted" />
                <div className="h-6 w-36 rounded-full bg-muted" />
              </div>
              <div className="h-4 w-72 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="h-14 w-full rounded-xl bg-muted/60" />
              <div className="h-16 w-full rounded-xl bg-muted/40" />
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 bg-muted/15 px-6 py-4">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="flex gap-3">
                <div className="h-12 w-24 rounded-xl bg-muted" />
                <div className="h-12 w-24 rounded-xl bg-muted" />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
