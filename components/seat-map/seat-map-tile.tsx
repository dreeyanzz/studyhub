import type { ReactNode } from 'react'
import {
  Armchair,
  PersonStanding,
  DoorClosed,
  CheckCircle,
  Hourglass,
  Clock,
  User,
} from 'lucide-react'
import type { SeatMapUnit, SeatState, UnitType } from '@/lib/seat-map/grid'
import { cn } from '@/lib/utils'

const TYPE_CONFIG: Record<
  UnitType,
  {
    label: string
    icon: typeof Armchair
  }
> = {
  seat: { label: 'Seat', icon: Armchair },
  standing_desk: { label: 'Standing Desk', icon: PersonStanding },
  room: { label: 'Room', icon: DoorClosed },
}

// Light palette only, with no `dark:` variants: the app ships light mode only (D-031), and
// with no `.dark` class `dark:` follows the OS setting, which turned these tiles into grey
// with near-white text on the light page for anyone whose OS is in dark mode.
const STATE_CONFIG: Record<
  SeatState,
  {
    label: string
    icon: typeof CheckCircle
    tileClassName: string
    iconClassName: string
  }
> = {
  available: {
    label: 'Available',
    icon: CheckCircle,
    tileClassName: 'border-emerald-600/40 bg-emerald-50 text-emerald-950',
    iconClassName: 'text-emerald-700',
  },
  pending_payment: {
    label: 'Pending Payment',
    icon: Hourglass,
    tileClassName: 'border-purple-600/40 bg-purple-50 text-purple-950',
    iconClassName: 'text-purple-700',
  },
  reserved: {
    label: 'Reserved',
    icon: Clock,
    tileClassName: 'border-blue-600/40 bg-blue-50 text-blue-950',
    iconClassName: 'text-blue-700',
  },
  occupied: {
    label: 'Occupied',
    icon: User,
    tileClassName: 'border-amber-600/40 bg-amber-50 text-amber-950',
    iconClassName: 'text-amber-700',
  },
}

/**
 * Renders an individual unit tile on the snap grid (STORY-07, TSK-07.4, FR-3.1).
 *
 * Shows the unit label, room capacity if applicable, unit type icon, and seat state icon.
 * Features an accessible name pronouncing all details in words (e.g. "S4, Seat, Available").
 * Minimum dimensions are 48x48 px to meet touch target requirements (SRS §3.2.2). The width
 * and the icons are in px, not rem, so six tiles still fit a 360 px screen at 200% text;
 * the height is in rem, so a tile grows taller as its label wraps (design §3).
 */
export function SeatMapTile({
  unit,
  className,
}: {
  unit: SeatMapUnit
  className?: string
}): ReactNode {
  const typeInfo = TYPE_CONFIG[unit.unitType] ?? {
    label: unit.unitType,
    icon: Armchair,
  }
  const stateInfo = STATE_CONFIG[unit.seatState] ?? {
    label: unit.seatState,
    icon: CheckCircle,
    tileClassName: 'border-border bg-card text-foreground',
    iconClassName: 'text-foreground',
  }

  const isRoomWithCapacity =
    unit.unitType === 'room' && unit.capacity !== null && unit.capacity !== undefined
  const displayLabel = isRoomWithCapacity
    ? `${unit.label} (${unit.capacity})`
    : unit.label

  const accessibleName = `${displayLabel}, ${typeInfo.label}, ${stateInfo.label}`

  const TypeIcon = typeInfo.icon
  const StateIcon = stateInfo.icon

  return (
    <div
      role="img"
      aria-label={accessibleName}
      className={cn(
        'flex h-full min-h-12 w-full min-w-[48px] flex-col items-center justify-between rounded-md border p-1 text-center transition-colors select-none',
        stateInfo.tileClassName,
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-1">
        <TypeIcon className="size-[14px] shrink-0 opacity-80" aria-hidden="true" />
        <StateIcon
          className={cn('size-[14px] shrink-0', stateInfo.iconClassName)}
          aria-hidden="true"
        />
      </div>
      <span className="my-auto max-w-full px-0.5 text-xs leading-tight font-semibold break-words">
        {displayLabel}
      </span>
    </div>
  )
}
