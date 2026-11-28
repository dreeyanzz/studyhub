import Link from 'next/link'
import {
  Camera,
  LayoutGrid,
  Pencil,
  QrCode,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type HostSpaceSection =
  'occupancy' | 'check-in' | 'seat-map' | 'photos' | 'tags' | 'edit'

const SECTIONS: ReadonlyArray<{
  key: HostSpaceSection
  label: string
  icon: LucideIcon
}> = [
  { key: 'occupancy', label: 'Occupancy', icon: Users },
  { key: 'check-in', label: 'Check-in desk', icon: QrCode },
  { key: 'seat-map', label: 'Seat map', icon: LayoutGrid },
  { key: 'photos', label: 'Photos', icon: Camera },
  { key: 'tags', label: 'Tags', icon: Tag },
  { key: 'edit', label: 'Edit', icon: Pencil },
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
      className="flex flex-wrap items-center gap-2 border-b border-border/75 pb-4"
    >
      {SECTIONS.map(({ key, label, icon: Icon }) => {
        const isCurrent = key === current
        return (
          <Link
            key={key}
            href={`/host/spaces/${spaceId}/${key}`}
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: isCurrent ? 'default' : 'outline' }),
              'h-auto min-h-12 max-w-full min-w-12 gap-1.5 rounded-full px-4 py-2 text-center whitespace-normal',
              !isCurrent &&
                'border-border/80 bg-card text-foreground shadow-2xs hover:border-primary/45 hover:bg-surface-subtle',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
