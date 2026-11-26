import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

/**
 * Loading skeleton for `/admin/payments` (STORY-14 design §3 Screen 3, TSK-14.4).
 */
export default function AdminPaymentsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Payment Records
        </h1>
        <p className="text-sm text-muted-foreground">
          Inspect paid, forfeited, and refunded sandbox fees, and refund a fee whose hold
          ended without a check-in.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((tabId) => (
          <div
            key={tabId}
            className="h-12 w-24 animate-pulse rounded-lg bg-muted"
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((placeholderId) => (
          <Card key={placeholderId} className="animate-pulse bg-muted/50">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="h-6 w-48 rounded bg-muted" />
                <div className="h-6 w-24 rounded-full bg-muted" />
              </div>
              <div className="h-4 w-64 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-56 rounded bg-muted" />
              <div className="h-4 w-72 rounded bg-muted" />
            </CardContent>
            <CardFooter className="flex justify-end">
              <div className="h-12 w-24 rounded-lg bg-muted" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
