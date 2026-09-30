import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * PreviewCards component (STORY-04).
 * Server Component rendering informational preview cards for upcoming features:
 * - Search & Filter (Sprint 2)
 * - Seat Reservations (Sprint 3)
 * Note: These cards are purely informational and are deliberately NOT tab stops
 * to maintain a smooth keyboard navigation flow (STORY-04 design §3).
 */
export function PreviewCards() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Upcoming Features
        </h2>
        <p className="text-sm text-muted-foreground">
          Explore what is coming next in future sprints for Worq Seekers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg font-semibold">Space Search & Map</CardTitle>
              <Badge variant="secondary">Sprint 2</Badge>
            </div>
            <CardDescription>
              Find nearby study lofts and co-working spaces with interactive map search
              and tag filters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Search by Wi-Fi tier, power outlets, noise level and other curated tags
              coming soon.
            </p>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg font-semibold">Seat Reservations</CardTitle>
              <Badge variant="secondary">Sprint 3</Badge>
            </div>
            <CardDescription>
              Select your exact unit on the Space&apos;s seat map and hold it instantly
              with a sandbox reservation fee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              QR booking tokens and check-in coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
