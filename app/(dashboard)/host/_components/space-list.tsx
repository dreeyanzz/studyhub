import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Database } from '@/lib/supabase/database.types'
import { formatDateTime, formatOpeningHours } from '@/lib/space/format'

type SpaceRow = Database['public']['Tables']['spaces']['Row']
type SpaceStatus = Database['public']['Enums']['space_status']

/** The columns the Host portal reads for each Space (STORY-05 design §2.7). */
export type SpaceListItem = Pick<
  SpaceRow,
  | 'id'
  | 'name'
  | 'description'
  | 'address'
  | 'opens_at'
  | 'closes_at'
  | 'status'
  | 'updated_at'
>

// Every Verification status is written out, so no meaning depends on the badge
// color alone (design §3.2 and §3.6). The seat map page shows the same badge.
export const statusBadges: Record<
  SpaceStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  pending: { label: 'Pending verification', variant: 'secondary' },
  verified: { label: 'Verified', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

function SpaceCard({ space }: { space: SpaceListItem }) {
  const status = statusBadges[space.status]

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="min-w-0">
            <h3 className="text-lg font-semibold wrap-anywhere">{space.name}</h3>
          </CardTitle>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <CardDescription className="wrap-anywhere">{space.address}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {/* React escapes stored text, so a description can never run as HTML (§4.2). */}
        {space.description ? (
          <p className="wrap-anywhere whitespace-pre-line">{space.description}</p>
        ) : null}
        <dl className="space-y-1">
          <div>
            <dt className="inline font-medium">Daily hours: </dt>
            <dd className="inline">
              {formatOpeningHours(space.opens_at, space.closes_at)}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Last updated: </dt>
            <dd className="inline">
              <time dateTime={space.updated_at}>{formatDateTime(space.updated_at)}</time>
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {/* The hidden name completes each link's accessible name, so every card's
            "Edit" and "Delete" say which Space they act on (design §3.2). */}
        <Link
          href={`/host/spaces/${space.id}/seat-map`}
          className={buttonVariants({ variant: 'outline' })}
        >
          Seat map<span className="sr-only"> for {space.name}</span>
        </Link>
        <Link
          href={`/host/spaces/${space.id}/edit`}
          className={buttonVariants({ variant: 'outline' })}
        >
          Edit<span className="sr-only"> {space.name}</span>
        </Link>
        {/* Only opens the confirmation page; nothing is deleted until it is submitted. */}
        <Link
          href={`/host/spaces/${space.id}/delete`}
          className={buttonVariants({ variant: 'destructive' })}
        >
          Delete<span className="sr-only"> {space.name}</span>
        </Link>
      </CardFooter>
    </Card>
  )
}

/**
 * The signed-in Host's own Spaces as cards, or an empty state that points to the
 * create section (STORY-05 design §3.2). The list is what the server read; nothing
 * here claims a change before Postgres has accepted it.
 */
export function SpaceList({
  spaces,
  canCreate,
}: {
  spaces: SpaceListItem[]
  canCreate: boolean
}) {
  // An Administrator may open /host (D-032), owns no Spaces, and has no create form
  // to be pointed to (#145).
  if (spaces.length === 0 && !canCreate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You have no Spaces</CardTitle>
          <CardDescription>Spaces belong to the Hosts who create them.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (spaces.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You have no Spaces yet</CardTitle>
          <CardDescription>
            Use Create a Space above to add your first one. It stays Pending verification,
            and hidden from Seekers, until an Administrator verifies it.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {spaces.map((space) => (
        <li key={space.id}>
          <SpaceCard space={space} />
        </li>
      ))}
    </ul>
  )
}
