'use client'

import {
  ArrowDown,
  ArrowUp,
  Armchair,
  DoorClosed,
  Move,
  PersonStanding,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'

import { SeatMapGrid } from '@/components/seat-map/seat-map-grid'
import { SeatMapTile } from '@/components/seat-map/seat-map-tile'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  GRID_COLS,
  describeCell,
  describePlaceAction,
  hasCollision,
  nextSuggestedLabel,
  type SeatMapUnit,
  type SeatMapZone,
  type UnitType,
} from '@/lib/seat-map/grid'
import { cn } from '@/lib/utils'

import {
  addUnit,
  moveUnit,
  moveZoneDown,
  moveZoneUp,
  type SeatMapActionState,
} from '../actions'
import { ConfirmRemoval, type RemovalTarget } from './confirm-removal'
import { UnitForm, selectClassName, unitTypeNames } from './unit-form'
import { ZoneForm } from './zone-form'

type SeatMapBuilderProps = {
  spaceId: string
  /** The saved seat map, from getSeatMap (D-047). */
  zones: SeatMapZone[]
  /** What ?remove= or ?delete-zone= asks to remove, if it is in this Space. */
  confirm: RemovalTarget | null
  /** The page without a query, for Cancel and after a removal. */
  baseHref: string
}

/** What the Host is placing, picked from the toolbar. */
type Placing = { unitType: UnitType }

const typeIcons: Record<UnitType, typeof Armchair> = {
  seat: Armchair,
  standing_desk: PersonStanding,
  room: DoorClosed,
}

const cellButtonClass =
  'flex w-full items-center justify-center rounded-md border border-dashed border-primary/60 bg-primary/5 text-primary outline-none hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50'

/**
 * The Host's snap-grid builder (STORY-07 design §3, TSK-07.6, D-062).
 *
 * - The toolbar picks a seat, a standing desk or a whole room, and the empty cells where
 *   it fits become "Place at row 2, column 3 in Quiet desks" buttons. Otherwise they stay
 *   plain gaps, so the grid holds few tab stops.
 * - Tapping a unit selects it and opens its panel: Edit, Move (then tap an empty cell,
 *   in any zone) and Remove.
 * - Each zone's header moves it up or down, renames it, or deletes it.
 *
 * Every change saves at once through its own Server Action, and the database's rules
 * decide (overlaps 23P01, duplicate labels 23505, RLS 42501). Remove and Delete go
 * through the page's confirmation step (?remove=, ?delete-zone=). TSK-07.7's list view
 * offers every action here by keyboard alone and before JavaScript loads.
 */
export function SeatMapBuilder({
  spaceId,
  zones,
  confirm,
  baseHref,
}: SeatMapBuilderProps) {
  const router = useRouter()
  const [placing, setPlacing] = useState<Placing | null>(null)
  const [roomWidth, setRoomWidth] = useState('2')
  const [roomCapacity, setRoomCapacity] = useState('4')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [renamingZoneId, setRenamingZoneId] = useState<string | null>(null)
  const [addingZone, setAddingZone] = useState(zones.length === 0)
  const [announcement, setAnnouncement] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // After a change, focus goes to the first of these ids that is on the page and
  // usable, once the saved seat map comes back (design §3, Accessibility).
  const focusAfterSave = useRef<string[]>([])
  const panelHeading = useRef<HTMLHeadingElement>(null)
  // The unit or zone whose confirmation form was just submitted. A successful removal
  // takes the confirmation panel away in the same render, so the builder, which stays,
  // checks the refreshed map and finishes the job.
  const removing = useRef<RemovalTarget | null>(null)

  // Defined before the focus effect, so the focus it asks for is applied in the same
  // commit.
  useEffect(() => {
    const target = removing.current
    if (!target || confirm) return
    removing.current = null
    const stillThere =
      target.kind === 'unit'
        ? zones.some((zone) => zone.units.some((unit) => unit.id === target.id))
        : zones.some((zone) => zone.id === target.id)
    if (stillThere) return
    setAnnouncement(
      target.kind === 'unit'
        ? `Removed ${target.label} from ${target.zoneName}.`
        : `Deleted ${target.name}.`,
    )
    setSelectedId(null)
    setMoving(false)
    setEditing(false)
    focusAfterSave.current =
      target.kind === 'unit'
        ? [`zone-heading-${target.zoneId}`]
        : [...zones.map((zone) => `zone-heading-${zone.id}`), 'add-zone']
    // Drop ?remove= or ?delete-zone=, so a reload doesn't ask about it again.
    router.replace(baseHref, { scroll: false })
  }, [confirm, zones, baseHref, router])

  useEffect(() => {
    for (const id of focusAfterSave.current) {
      const element = document.getElementById(id)
      if (element && !(element as HTMLButtonElement).disabled) {
        element.focus()
        focusAfterSave.current = []
        return
      }
    }
  }, [zones])

  // Opening a unit's panel moves focus into it, so its actions come next.
  useEffect(() => {
    if (selectedId) panelHeading.current?.focus()
  }, [selectedId])

  const allUnits = zones.flatMap((zone) =>
    zone.units.map((unit) => ({ ...unit, zoneId: zone.id, zoneName: zone.name })),
  )
  const selected = allUnits.find((unit) => unit.id === selectedId) ?? null
  const placingSpan = placing?.unitType === 'room' ? Number(roomWidth) : 1
  const nextLabel = placing ? nextSuggestedLabel(allUnits, placing.unitType) : ''

  /** Runs one Server Action, then either reports its error or calls onSaved. */
  function save(
    task: () => Promise<SeatMapActionState>,
    onSaved: (result: SeatMapActionState) => void,
  ) {
    setError(null)
    startTransition(async () => {
      const result = await task()
      if (result.success) {
        onSaved(result)
      } else {
        const fieldError = Object.values(result.fieldErrors ?? {})[0]?.[0]
        setError(
          result.formError ??
            fieldError ??
            'We could not save that change. Please try again.',
        )
      }
    })
  }

  function startPlacing(unitType: UnitType) {
    setSelectedId(null)
    setMoving(false)
    setEditing(false)
    setError(null)
    setPlacing(placing?.unitType === unitType ? null : { unitType })
  }

  function place(zone: SeatMapZone, row: number, col: number) {
    if (!placing) return
    const label = nextLabel
    const unitType = placing.unitType
    save(
      () =>
        addUnit({
          spaceId,
          zoneId: zone.id,
          unitType,
          label,
          capacity: unitType === 'room' ? roomCapacity : null,
          row,
          col,
          colSpan: placingSpan,
        }),
      (result) => {
        setAnnouncement(
          `Placed ${label} at ${describeCell(row, col, placingSpan).toLowerCase()} in ${zone.name}.`,
        )
        // Design §1: the new unit's tile renders, and focus moves to it.
        const created = result.data as { id?: string } | undefined
        if (created?.id) focusAfterSave.current = [`unit-${created.id}`]
      },
    )
  }

  function moveTo(zone: SeatMapZone, row: number, col: number) {
    if (!selected) return
    const unit = selected
    save(
      () =>
        moveUnit({
          spaceId,
          unitId: unit.id,
          zoneId: zone.id,
          row,
          col,
          // moveUnitSchema needs the unit's width to check the grid's right edge (#217).
          colSpan: unit.colSpan,
        }),
      () => {
        setMoving(false)
        setAnnouncement(
          `Moved ${unit.label} to ${describeCell(row, col, unit.colSpan).toLowerCase()} in ${zone.name}.`,
        )
        focusAfterSave.current = [`unit-${unit.id}`]
      },
    )
  }

  function moveZone(zone: SeatMapZone, direction: 'up' | 'down') {
    save(
      () =>
        (direction === 'up' ? moveZoneUp : moveZoneDown)({ spaceId, zoneId: zone.id }),
      () => {
        setAnnouncement(`Moved ${zone.name} ${direction}.`)
        focusAfterSave.current = [
          `zone-${direction}-${zone.id}`,
          `zone-${direction === 'up' ? 'down' : 'up'}-${zone.id}`,
          `zone-heading-${zone.id}`,
        ]
      },
    )
  }

  function selectUnit(unit: SeatMapUnit) {
    setPlacing(null)
    setMoving(false)
    setEditing(false)
    setError(null)
    setSelectedId(unit.id === selectedId ? null : unit.id)
  }

  function closePanel() {
    if (selected) focusAfterSave.current = [`unit-${selected.id}`]
    setSelectedId(null)
    setMoving(false)
    setEditing(false)
    // Nothing was saved, so return focus now rather than after a save.
    requestAnimationFrame(() => {
      const id = focusAfterSave.current[0]
      if (id) document.getElementById(id)?.focus()
      focusAfterSave.current = []
    })
  }

  function renderUnit(unit: SeatMapUnit): ReactNode {
    const isSelected = unit.id === selectedId
    return (
      <button
        type="button"
        id={`unit-${unit.id}`}
        aria-pressed={isSelected}
        onClick={() => selectUnit(unit)}
        className={cn(
          'flex w-full rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isSelected && 'ring-3 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        <SeatMapTile unit={unit} />
      </button>
    )
  }

  function renderEmptyCell({
    zoneId,
    row,
    col,
  }: {
    zoneId: string
    row: number
    col: number
  }) {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return null
    const gap = (
      <div
        aria-hidden="true"
        className="w-full rounded-md border border-dashed border-border"
      />
    )

    if (moving && selected) {
      const candidate = { id: selected.id, row, col, colSpan: selected.colSpan }
      if (col + selected.colSpan > GRID_COLS || hasCollision(candidate, zone.units))
        return gap
      return (
        <button
          type="button"
          disabled={pending}
          onClick={() => moveTo(zone, row, col)}
          className={cellButtonClass}
          aria-label={`Move ${selected.label} to row ${row + 1}, column ${col + 1} in ${zone.name}`}
        >
          <Move className="size-4" aria-hidden="true" />
        </button>
      )
    }

    if (placing) {
      if (
        col + placingSpan > GRID_COLS ||
        hasCollision({ row, col, colSpan: placingSpan }, zone.units)
      ) {
        return gap
      }
      return (
        <button
          type="button"
          id={`place-${zone.id}-${row}-${col}`}
          disabled={pending}
          onClick={() => place(zone, row, col)}
          className={cellButtonClass}
          aria-label={describePlaceAction(row, col, zone.name)}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      )
    }

    return gap
  }

  function renderZoneActions(zone: SeatMapZone): ReactNode {
    const index = zones.findIndex((z) => z.id === zone.id)
    const count = zone.units.length
    return (
      <>
        <span className="text-sm text-muted-foreground">
          {count} {count === 1 ? 'unit' : 'units'}
        </span>
        <div className="flex flex-wrap gap-1">
          <Button
            id={`zone-up-${zone.id}`}
            variant="ghost"
            size="icon"
            aria-label={`Move ${zone.name} up`}
            disabled={index === 0 || pending}
            onClick={() => moveZone(zone, 'up')}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            id={`zone-down-${zone.id}`}
            variant="ghost"
            size="icon"
            aria-label={`Move ${zone.name} down`}
            disabled={index === zones.length - 1 || pending}
            onClick={() => moveZone(zone, 'down')}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            aria-expanded={renamingZoneId === zone.id}
            onClick={() => setRenamingZoneId(renamingZoneId === zone.id ? null : zone.id)}
          >
            Rename<span className="sr-only"> {zone.name}</span>
          </Button>
          <Link
            href={`${baseHref}?delete-zone=${zone.id}#confirm`}
            scroll={false}
            className={cn(buttonVariants({ variant: 'ghost' }), 'text-destructive')}
          >
            Delete<span className="sr-only"> {zone.name}</span>
          </Link>
        </div>
        {renamingZoneId === zone.id && (
          <div className="basis-full">
            <ZoneForm
              mode="rename"
              spaceId={spaceId}
              zone={zone}
              onCancel={() => setRenamingZoneId(null)}
              onDone={(saved) => {
                setRenamingZoneId(null)
                setAnnouncement(`Renamed the zone to ${saved.name}.`)
                focusAfterSave.current = [`zone-heading-${zone.id}`]
              }}
            />
          </div>
        )}
        {count === 0 && (
          <p className="basis-full text-sm text-muted-foreground">
            This zone has no units. Pick a unit type above, then tap an empty cell.
          </p>
        )}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <section aria-labelledby="toolbar-heading" className="space-y-3">
        <h2 id="toolbar-heading" className="text-base font-semibold text-foreground">
          Add to the map
        </h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(unitTypeNames) as UnitType[]).map((unitType) => {
            const Icon = typeIcons[unitType]
            const active = placing?.unitType === unitType
            return (
              <Button
                key={unitType}
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                disabled={zones.length === 0}
                onClick={() => startPlacing(unitType)}
              >
                <Icon aria-hidden="true" />
                {unitTypeNames[unitType]}
              </Button>
            )
          })}
          <Button
            id="add-zone"
            variant="outline"
            aria-expanded={addingZone}
            onClick={() => setAddingZone(!addingZone)}
          >
            <Plus aria-hidden="true" />
            Zone
          </Button>
        </div>

        {placing?.unitType === 'room' && (
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-width">Room width</Label>
              <select
                id="room-width"
                className={selectClassName}
                value={roomWidth}
                onChange={(event) => setRoomWidth(event.target.value)}
              >
                <option value="2">2 cells</option>
                <option value="3">3 cells</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-capacity">Capacity (people)</Label>
              <Input
                id="room-capacity"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={roomCapacity}
                onChange={(event) => setRoomCapacity(event.target.value)}
              />
            </div>
          </div>
        )}

        {placing && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-foreground">
              Tap an empty cell to place <strong>{nextLabel}</strong>. You can change its
              label after.
            </p>
            <Button variant="ghost" onClick={() => setPlacing(null)}>
              Done placing
            </Button>
          </div>
        )}

        {zones.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Start with a zone, such as &ldquo;Quiet desks&rdquo;. Zones group your units
            on the map.
          </p>
        )}

        {addingZone && (
          <div className="max-w-md">
            <ZoneForm
              mode="add"
              spaceId={spaceId}
              position={zones.length}
              onCancel={zones.length === 0 ? undefined : () => setAddingZone(false)}
              onDone={(saved) => {
                setAddingZone(false)
                setAnnouncement(`Added the zone ${saved.name}.`)
                focusAfterSave.current = [`zone-heading-${saved.id}`]
              }}
            />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </section>

      {confirm && (
        <ConfirmRemoval
          key={`${confirm.kind}-${confirm.id}`}
          spaceId={spaceId}
          target={confirm}
          cancelHref={baseHref}
          onSubmitted={(target) => {
            removing.current = target
          }}
        />
      )}

      {!confirm && selected && (
        <section
          aria-labelledby="unit-panel-heading"
          className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <h2
                id="unit-panel-heading"
                ref={panelHeading}
                tabIndex={-1}
                className="text-lg font-semibold wrap-anywhere text-foreground"
              >
                {selected.label}
              </h2>
              <p className="text-sm wrap-anywhere text-muted-foreground">
                {unitTypeNames[selected.unitType]}
                {selected.unitType === 'room' &&
                  `, for ${selected.capacity} people, ${selected.colSpan} cells wide`}
                {' · '}
                {selected.zoneName},{' '}
                {describeCell(selected.row, selected.col, selected.colSpan).toLowerCase()}
              </p>
            </div>
            <Button variant="ghost" onClick={closePanel}>
              Close<span className="sr-only"> {selected.label}</span>
            </Button>
          </div>

          {moving ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-foreground">
                Tap an empty cell, in any zone, to move <strong>{selected.label}</strong>{' '}
                there.
              </p>
              <Button variant="ghost" onClick={() => setMoving(false)}>
                Cancel move
              </Button>
            </div>
          ) : editing ? (
            <UnitForm
              spaceId={spaceId}
              zoneId={selected.zoneId}
              unit={selected}
              onCancel={() => setEditing(false)}
              onDone={(saved) => {
                setEditing(false)
                setAnnouncement(`Saved ${saved.label}.`)
                focusAfterSave.current = [`unit-${saved.id}`]
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit<span className="sr-only"> {selected.label}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMoving(true)
                  setAnnouncement(`Tap an empty cell to move ${selected.label}.`)
                }}
              >
                Move<span className="sr-only"> {selected.label}</span>
              </Button>
              <Link
                href={`${baseHref}?remove=${selected.id}#confirm`}
                scroll={false}
                className={buttonVariants({ variant: 'destructive' })}
              >
                Remove<span className="sr-only"> {selected.label}</span>
              </Link>
            </div>
          )}
        </section>
      )}

      {zones.length > 0 && (
        <SeatMapGrid
          zones={zones}
          extraRows={placing || moving ? 1 : 0}
          renderUnit={renderUnit}
          renderEmptyCell={renderEmptyCell}
          renderZoneActions={renderZoneActions}
        />
      )}
    </div>
  )
}
