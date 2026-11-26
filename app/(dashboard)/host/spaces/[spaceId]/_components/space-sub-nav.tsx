import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type HostSpaceSection =
  'occupancy' | 'check-in' | 'seat-map' | 'photos' | 'tags' | 'edit'

const SECTIONS: ReadonlyArray<{ key: HostSpaceSection; label: string }> = [
  { key: 'occupancy', label: 'Occupancy' },
  { key: 'check-in', label: 'Check-in desk' },
  { key: 'seat-map', label: 'Seat map' },
  { key: 'photos', label: 'Photos' },
  { key: 'tags', label: 'Tags' },
  { key: 'edit', label: 'Edit' },
]

/**
 * Shared sub-navigation across a Space's Host workspaces (STORY-17). Lets a Host
 * move directly between Occupancy, Check-in desk, Seat map, Photos, Tags, and Edit
 * without returning to /host.
 */
export function SpaceSubNav({
  spaceId,
  current,
}: {
  spaceId: string
  current: HostSpaceSection
}) {
  return (
    <nav
      aria-label="Space sections"
      className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3"
    >
      {SECTIONS.map(({ key, label }) => {
        const isCurrent = key === current
        return (
          <Link
            key={key}
            href={`/host/spaces/${spaceId}/${key}`}
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: isCurrent ? 'secondary' : 'ghost' }),
              'h-auto min-h-12 max-w-full min-w-12 rounded-full px-4 py-2 text-center whitespace-normal',
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
