'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Filter,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  setSpaceStatusAction,
  type SetSpaceStatusResult,
} from '@/app/(dashboard)/admin/actions'
import { cn } from '@/lib/utils'
import { RejectionDialog } from './rejection-dialog'
import { SpaceInspectionDialog } from './space-inspection-dialog'
import { VerificationCard, type VerificationCardItem } from './verification-card'

export type PendingSpace = VerificationCardItem

interface VerificationQueueProps {
  initialSpaces: PendingSpace[]
}

type Notice = {
  id: string
  type: 'success' | 'error'
  title: string
  message: string
}

/**
 * Verification queue component for Administrators (STORY-15 design §3).
 * Renders the list of pending Spaces, active count badge, empty state,
 * search & campus filter bar, inspection dossier dialog, and actionable rejection dialog.
 */
export function VerificationQueue({ initialSpaces }: VerificationQueueProps) {
  const [spaces, setSpaces] = useState<PendingSpace[]>(initialSpaces)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCampusFilter, setActiveCampusFilter] = useState<
    'all' | 'usc' | 'citu' | '24h'
  >('all')

  // Inspection and Rejection Dialog states
  const [inspectingSpace, setInspectingSpace] = useState<PendingSpace | null>(null)
  const [rejectingSpace, setRejectingSpace] = useState<PendingSpace | null>(null)

  async function handleDecision(space: PendingSpace, status: 'verified' | 'rejected') {
    const result: SetSpaceStatusResult = await setSpaceStatusAction({
      spaceId: space.id,
      status,
      updatedAt: space.updated_at,
    })

    if (result.success) {
      setRemovingId(space.id)
      const decisionVerb = status === 'verified' ? 'approved' : 'rejected'
      setNotice({
        id: `${space.id}-${Date.now()}`,
        type: 'success',
        title: status === 'verified' ? 'Space approved' : 'Space rejected',
        message: `${space.name} has been ${decisionVerb}.`,
      })
      setTimeout(() => {
        setSpaces((prev) => prev.filter((item) => item.id !== space.id))
        setRemovingId(null)
      }, 250)
    } else {
      setNotice({
        id: `${space.id}-${Date.now()}`,
        type: 'error',
        title: 'Action could not be completed',
        message: result.error,
      })
    }
  }

  async function handleConfirmRejectWithReason(space: PendingSpace, _reason: string) {
    await handleDecision(space, 'rejected')
  }

  // Filtered queue based on live search and campus filters
  const filteredSpaces = spaces.filter((space) => {
    const matchesSearch =
      !searchQuery.trim() ||
      space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      space.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (space.host_name &&
        space.host_name.toLowerCase().includes(searchQuery.toLowerCase()))

    let matchesFilter = true
    const addr = space.address.toLowerCase()
    if (activeCampusFilter === 'usc') {
      matchesFilter =
        addr.includes('usc') || addr.includes('talamban') || addr.includes('banilad')
    } else if (activeCampusFilter === 'citu') {
      matchesFilter = addr.includes('cit') || addr.includes('natalio')
    } else if (activeCampusFilter === '24h') {
      matchesFilter =
        (space.opens_at === '00:00:00' && space.closes_at === '23:59:00') ||
        (space.opens_at === '00:00' && space.closes_at === '24:00')
    }

    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div
        className="animate-fade-in-up -m-2 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-2"
        data-tour="verification-queue"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Space Verification
          </h1>
          <p className="mt-1 text-sm font-medium text-foreground/85">
            Review pending Spaces. Approved Spaces become immediately visible in public
            search.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="rounded-xl border border-border/80 bg-secondary/80 px-3.5 py-1.5 text-sm font-bold text-foreground shadow-2xs"
        >
          {spaces.length} pending
        </Badge>
      </div>

      {/* Professional Guidance Banner */}
      <div
        className="animate-fade-in-up flex items-start gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 shadow-2xs"
        style={{ animationDelay: '40ms' }}
      >
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-2xs">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </div>
        <div className="text-sm leading-relaxed text-foreground">
          <strong className="font-bold text-foreground">Administrator Guide:</strong>{' '}
          Inspect the venue&apos;s operating hours and campus vicinity. Approving
          immediately pushes coordinates to the public map engine. Rejections provide
          actionable feedback to help the host resubmit.
        </div>
      </div>

      {/* Overview metric cards */}
      <div
        className="animate-fade-in-up grid grid-cols-1 gap-3 sm:grid-cols-3"
        style={{ animationDelay: '80ms' }}
      >
        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-primary/40 bg-card p-4.5 shadow-xs ring-1 ring-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:shadow-primary/10">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs transition-transform duration-300 group-hover:scale-105">
            <Clock className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-primary uppercase">
              Pending Review
            </p>
            <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {spaces.length} {spaces.length === 1 ? 'Space' : 'Spaces'}
            </p>
          </div>
        </div>

        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/10">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-100/90 text-sky-800 shadow-2xs ring-1 ring-sky-300/50 transition-transform duration-300 group-hover:scale-105 dark:bg-sky-950/70 dark:text-sky-300">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
              Quality Standard
            </p>
            <p className="text-sm font-bold text-foreground">Verified Standards</p>
          </div>
        </div>

        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-800 shadow-2xs ring-1 ring-amber-300/50 transition-transform duration-300 group-hover:scale-105 dark:bg-amber-950/60 dark:text-amber-300">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
              Search Sync
            </p>
            <p className="text-sm font-bold text-foreground">Instant Map Publishing</p>
          </div>
        </div>
      </div>

      {/* Live Search & Campus Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter pending spaces by name, address, or host..."
            className="w-full rounded-xl border border-border/80 bg-background py-2 pr-8 pl-9 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
            <Filter className="size-3" />
            <span>Filter:</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveCampusFilter('all')}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              activeCampusFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            All ({spaces.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCampusFilter('usc')}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              activeCampusFilter === 'usc'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            Near USC
          </button>
          <button
            type="button"
            onClick={() => setActiveCampusFilter('citu')}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              activeCampusFilter === 'citu'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            Near CIT-U
          </button>
        </div>
      </div>

      {notice ? (
        <Alert
          role="status"
          aria-live="polite"
          variant={notice.type === 'error' ? 'destructive' : 'default'}
          className="animate-fade-in relative rounded-2xl border-border/80 pr-12 shadow-xs"
        >
          <div className="flex flex-col gap-1">
            <AlertTitle className="font-semibold">{notice.title}</AlertTitle>
            <AlertDescription className="text-sm">{notice.message}</AlertDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </Alert>
      ) : null}

      {spaces.length === 0 ? (
        <Card className="animate-fade-in flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center shadow-xs">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-xs">
            <CheckCircle2 className="size-7 text-primary" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground">All caught up!</h2>
          <p className="mt-1.5 max-w-md text-sm font-medium text-foreground/85">
            There are currently no study spaces pending verification. Newly submitted
            spaces from hosts will automatically appear here.
          </p>
        </Card>
      ) : filteredSpaces.length === 0 ? (
        <Card className="animate-fade-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-muted-foreground">
            No pending spaces match your current search or filter.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery('')
              setActiveCampusFilter('all')
            }}
            className="mt-3 text-xs"
          >
            Reset filter
          </Button>
        </Card>
      ) : (
        <div className="space-y-5">
          {filteredSpaces.map((space, index) => (
            <div
              key={space.id}
              data-tour={index === 0 ? 'inspection-card' : undefined}
              className={cn(
                'transition-all duration-300 ease-out',
                removingId === space.id
                  ? 'pointer-events-none -translate-x-3 scale-95 opacity-0'
                  : 'animate-fade-in-up',
              )}
              style={{ animationDelay: `${160 + index * 100}ms` }}
            >
              <VerificationCard
                space={space}
                onDecision={handleDecision}
                onInspect={(s) => setInspectingSpace(s)}
              />
            </div>
          ))}
        </div>
      )}

      {/* High-Value Modal 1: Full Venue Inspection Dossier */}
      <SpaceInspectionDialog
        space={inspectingSpace}
        isOpen={!!inspectingSpace}
        onClose={() => setInspectingSpace(null)}
        onApprove={async (s) => {
          await handleDecision(s, 'verified')
        }}
        onOpenReject={(s) => {
          setRejectingSpace(s)
        }}
      />

      {/* High-Value Modal 2: Actionable Rejection Reason Picker */}
      <RejectionDialog
        space={rejectingSpace}
        isOpen={!!rejectingSpace}
        onClose={() => setRejectingSpace(null)}
        onConfirmReject={handleConfirmRejectWithReason}
      />
    </div>
  )
}
