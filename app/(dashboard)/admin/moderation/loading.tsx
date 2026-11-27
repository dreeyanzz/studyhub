import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

/**
 * Loading skeleton for `/admin/moderation` (STORY-14 design §3 Screen 2, TSK-14.3).
 */
export default function AdminModerationLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="border-b border-border/70 pb-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Review Moderation
        </h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Review reported content, restore hidden reviews, or remove them permanently.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((tabId) => (
          <div
            key={tabId}
            className="h-12 w-28 animate-pulse rounded-xl bg-muted"
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((placeholderId) => (
          <Card
            key={placeholderId}
            className="animate-pulse overflow-hidden rounded-2xl border-border/70 bg-card shadow-xs"
          >
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="h-6 w-48 rounded bg-muted" />
                <div className="h-6 w-28 rounded-full bg-muted" />
              </div>
              <div className="h-4 w-64 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map((cell) => (
                  <div key={cell} className="h-12 rounded-md bg-muted" />
                ))}
              </div>
              <div className="h-4 w-full max-w-lg rounded bg-muted" />
              <div className="h-16 w-full rounded-lg bg-muted" />
            </CardContent>
            <CardFooter className="flex flex-wrap justify-end gap-3">
              <div className="h-12 w-24 rounded-lg bg-muted" />
              <div className="h-12 w-28 rounded-lg bg-muted" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
