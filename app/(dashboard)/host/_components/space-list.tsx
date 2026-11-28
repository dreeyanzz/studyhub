import Link from 'next/link'
import {
  Camera,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  LayoutGrid,
  MapPin,
  Pencil,
  QrCode,
  Tag,
  Trash2,
  Users,
} from 'lucide-react'

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
import { cn } from '@/lib/utils'

import { ResubmitSpaceButton } from './resubmit-space-button'

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
  | 'status_reason'
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
  // STORY-20 (D-084).
  taken_down: { label: 'Taken down', variant: 'destructive' },
}

/** Completion flags for a Space's initial setup steps (STORY-17). */
export interface SpaceSetupStatus {
  hasUnits: boolean
  hasPhotos: boolean
  hasTags: boolean
}

/**
 * What the Administrator's reason is called on a Host's card, or null when there is
 * none to show (STORY-20 design §3, D-084). A Pending Space with a reason was
 * resubmitted (V8), which keeps the last reason. A Verified Space never has one
 * (N12), and a Pending Space without one is new or was edited (V1, V6).
 */
export function statusReasonLabel(
  status: SpaceStatus,
  reason: string | null,
): string | null {
  if (!reason) return null
  switch (status) {
    case 'rejected':
      return 'Rejection reason:'
    case 'taken_down':
      return 'Take-down reason:'
    case 'pending':
      return 'Previous reason:'
    case 'verified':
      return null
  }
}

/** Only a Rejected or Taken down Space can be resubmitted (V8, N11). */
export function canResubmit(status: SpaceStatus): boolean {
  return status === 'rejected' || status === 'taken_down'
}

function SpaceSetupChecklist({
  spaceId,
  spaceName,
  setup,
}: {
  spaceId: string
  spaceName: string
  setup: SpaceSetupStatus
}) {
  const steps = [
    {
      key: 'seat-map',
      label: 'Seat map',
      done: setup.hasUnits,
      todoText: 'Add units',
    },
    {
      key: 'photos',
      label: 'Photos',
      done: setup.hasPhotos,
      todoText: 'Add photos',
    },
    {
      key: 'tags',
      label: 'Tags',
      done: setup.hasTags,
      todoText: 'Add tags',
    },
  ] as const

  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-3.5">
      <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Setup checklist
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {steps.map((step) => (
          <li
            key={step.key}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              {step.done ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="size-4 shrink-0 text-primary"
                />
              ) : (
                <Circle
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              )}
              <span className="font-medium text-foreground">{step.label}</span>
            </span>
            {step.done ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Done
              </span>
            ) : (
              <Link
                href={`/host/spaces/${spaceId}/${step.key}`}
                className="inline-flex min-h-12 min-w-12 items-center justify-end rounded-sm text-xs font-semibold text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {step.todoText}
                <span className="sr-only"> for {spaceName}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SpaceCard({ space, setup }: { space: SpaceListItem; setup?: SpaceSetupStatus }) {
  const status = statusBadges[space.status]
  const reasonLabel = statusReasonLabel(space.status, space.status_reason)
  const showChecklist =
    setup !== undefined &&
    (space.status === 'pending' || !setup.hasUnits || !setup.hasPhotos || !setup.hasTags)

  const actionLinkClass = cn(
    buttonVariants({ variant: 'outline' }),
    'h-auto min-h-12 max-w-full gap-1.5 rounded-xl border-border bg-card px-3.5 py-2 text-xs font-semibold whitespace-normal shadow-2xs hover:border-primary/40 hover:bg-surface-subtle',
  )

  return (
    <Card className="flex h-full flex-col rounded-3xl border-border/80 bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-hover">
      <CardHeader className="space-y-2 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="min-w-0">
            <h3 className="font-heading text-2xl font-bold tracking-[-0.02em] wrap-anywhere text-foreground">
              {space.name}
            </h3>
          </CardTitle>
          <Badge variant={status.variant} className="shrink-0 rounded-full px-3 py-1">
            {status.label}
          </Badge>
        </div>
        <CardDescription className="flex items-start gap-1.5 text-sm wrap-anywhere text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden="true" />
          <span>{space.address}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {/* React escapes stored text, so a description can never run as HTML (§4.2). */}
        {space.description ? (
          <p className="text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground/90">
            {space.description}
          </p>
        ) : null}
        {/* The Administrator's reason, as plain text: React escapes it as it does the
            description (STORY-20 design §3, D-084). */}
        {reasonLabel ? (
          <div className="rounded-xl border-l-4 border-destructive bg-destructive/5 px-3.5 py-2.5">
            <p className="text-sm font-semibold text-destructive">{reasonLabel}</p>
            <p className="text-sm wrap-anywhere whitespace-pre-line text-foreground/90">
              {space.status_reason}
            </p>
          </div>
        ) : null}
        <dl className="grid gap-2.5 rounded-2xl border border-border/60 bg-surface-subtle/85 p-3.5 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
              Daily hours
            </dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {formatOpeningHours(space.opens_at, space.closes_at)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">Last updated</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              <time dateTime={space.updated_at}>{formatDateTime(space.updated_at)}</time>
            </dd>
          </div>
        </dl>
        {showChecklist ? (
          <SpaceSetupChecklist spaceId={space.id} spaceName={space.name} setup={setup} />
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3 border-t border-border/60 bg-muted/20 pt-4">
        {/* First, so the one thing a Rejected or Taken down Space waits on comes
            before the everyday links (V8). */}
        {canResubmit(space.status) ? (
          <ResubmitSpaceButton spaceId={space.id} spaceName={space.name} />
        ) : null}
        {/* The hidden name completes each link's accessible name, so every card's
            "Edit" and "Delete" say which Space they act on (design §3.2). */}
        <div className="flex flex-wrap gap-2">
          <Link href={`/host/spaces/${space.id}/seat-map`} className={actionLinkClass}>
            <LayoutGrid className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Seat map<span className="sr-only"> for {space.name}</span>
          </Link>
          {/* STORY-12's view had no way in from here, only from the check-in desk. */}
          <Link href={`/host/spaces/${space.id}/occupancy`} className={actionLinkClass}>
            <Users className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Occupancy<span className="sr-only"> for {space.name}</span>
          </Link>
          <Link href={`/host/spaces/${space.id}/check-in`} className={actionLinkClass}>
            <QrCode className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Check-in desk<span className="sr-only"> for {space.name}</span>
          </Link>
          <Link href={`/host/spaces/${space.id}/photos`} className={actionLinkClass}>
            <Camera className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Photos<span className="sr-only"> for {space.name}</span>
          </Link>
          <Link href={`/host/spaces/${space.id}/tags`} className={actionLinkClass}>
            <Tag className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Tags<span className="sr-only"> for {space.name}</span>
          </Link>
          <Link href={`/host/spaces/${space.id}/edit`} className={actionLinkClass}>
            <Pencil className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Edit<span className="sr-only"> {space.name}</span>
          </Link>
          {space.status === 'verified' ? (
            <Link href={`/spaces/${space.id}`} className={actionLinkClass}>
              <ExternalLink
                className="size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              View public Space<span className="sr-only"> for {space.name}</span>
            </Link>
          ) : null}
          {/* Only opens the confirmation page; nothing is deleted until it is submitted. */}
          <Link
            href={`/host/spaces/${space.id}/delete`}
            className={cn(
              buttonVariants({ variant: 'destructive' }),
              'h-auto min-h-12 gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-normal',
            )}
          >
            <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
            Delete<span className="sr-only"> {space.name}</span>
          </Link>
        </div>
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
  setupBySpaceId,
}: {
  spaces: SpaceListItem[]
  canCreate: boolean
  setupBySpaceId?: Record<string, SpaceSetupStatus>
}) {
  // An Administrator may open /host (D-032), owns no Spaces, and has no create form
  // to be pointed to (#145).
  if (spaces.length === 0 && !canCreate) {
    return (
      <Card className="rounded-2xl border-border/80 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg">You have no Spaces</CardTitle>
          <CardDescription>Spaces belong to the Hosts who create them.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (spaces.length === 0) {
    return (
      <Card className="rounded-2xl border-border/80 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg">You have no Spaces yet</CardTitle>
          <CardDescription>
            Use Create a Space above to add your first one. It stays Pending verification,
            and hidden from Seekers, until an Administrator verifies it.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <ul className="grid gap-5 lg:grid-cols-2">
      {spaces.map((space) => (
        <li key={space.id}>
          <SpaceCard space={space} setup={setupBySpaceId?.[space.id]} />
        </li>
      ))}
    </ul>
  )
}
