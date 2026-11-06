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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Space Verification
        </h1>
        <p className="text-sm text-muted-foreground">
          Review pending Spaces. Approved Spaces become immediately visible in public
          search.
        </p>
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((placeholderId) => (
          <Card key={placeholderId} className="animate-pulse bg-muted/50">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="h-6 w-48 rounded bg-muted" />
                <div className="h-5 w-36 rounded bg-muted" />
              </div>
              <div className="h-4 w-72 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full max-w-md rounded bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-4 w-44 rounded bg-muted" />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 pt-2">
              <div className="h-12 w-24 rounded bg-muted" />
              <div className="h-12 w-24 rounded bg-muted" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
