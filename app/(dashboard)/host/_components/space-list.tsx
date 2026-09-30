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
// color alone (design §3.2 and §3.6).
const statusBadges: Record<
  SpaceStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  pending: { label: 'Pending verification', variant: 'secondary' },
  verified: { label: 'Verified', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

// One opening and closing time for every day (D-027). Postgres returns a time as
// HH:mm:ss and the form saves HH:mm, so only the first five characters count.
// Equal times mean open 24 hours, and a closing time earlier than the opening
// time means the Space closes after midnight.
function hoursText(opensAt: string, closesAt: string) {
  const opens = opensAt.slice(0, 5)
  const closes = closesAt.slice(0, 5)
  if (opens === closes) return 'Open 24 hours'
  if (closes < opens) return `${opens} to ${closes} next day`
  return `${opens} to ${closes}`
}

// Assumption: Worq's Spaces are in the Philippines (the seeded ones are in Cebu
// City), and the server may run in UTC, so times are shown in Philippine time.
const updatedAtFormat = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: 'Asia/Manila',
})

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
            <dd className="inline">{hoursText(space.opens_at, space.closes_at)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Last updated: </dt>
            <dd className="inline">
              <time dateTime={space.updated_at}>
                {updatedAtFormat.format(new Date(space.updated_at))}
              </time>
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {/* The hidden name completes the link's accessible name, so every card's
            "Edit" says which Space it opens (design §3.2). */}
        <Link
          href={`/host/spaces/${space.id}/edit`}
          className={buttonVariants({ variant: 'outline' })}
        >
          Edit<span className="sr-only"> {space.name}</span>
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
export function SpaceList({ spaces }: { spaces: SpaceListItem[] }) {
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
