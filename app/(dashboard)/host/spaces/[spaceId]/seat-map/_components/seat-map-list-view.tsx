'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  describeCell,
  findFirstAvailableCell,
  getZoneRowCount,
  nextSuggestedLabel,
  type SeatMapZone,
} from '@/lib/seat-map/grid'
import { cn } from '@/lib/utils'

import { moveZoneDown, moveZoneDownForm, moveZoneUp, moveZoneUpForm } from '../actions'
import { ConfirmRemoval, type RemovalTarget } from './confirm-removal'
import { UnitForm, unitTypeNames } from './unit-form'
import { ZoneForm } from './zone-form'

const seatStateNames: Record<string, string> = {
  available: 'Available',
  pending_payment: 'Pending payment',
  reserved: 'Reserved',
  occupied: 'Occupied',
}

export type SeatMapListViewProps = {
  spaceId: string
  zones: SeatMapZone[]
  confirm: RemovalTarget | null
  baseHref: string
}

/**
 * The Host's accessible list view alternative for the seat map builder (STORY-07 design §3,
 * TSK-07.7, SRS §3.2.2).
 *
 * Offers every builder action (add/edit/move/delete unit and zone) operable via standard
 * HTML forms and keyboard alone (Tab, Enter, Space), and works before JavaScript loads.
 * Confirmation step displays in place for unit removals and zone deletions.
 */
export function SeatMapListView({
  spaceId,
  zones,
  confirm,
  baseHref,
}: SeatMapListViewProps): ReactNode {
  const router = useRouter()
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const focusAfterSave = useRef<string[]>([])
  const removing = useRef<RemovalTarget | null>(null)
  const [isPending, startTransition] = useTransition()

  const allUnits = zones.flatMap((z) => z.units)
  const listHref = `${baseHref}?view=list`

  // Removal cleanup and announcement (design §3)
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
    focusAfterSave.current =
      target.kind === 'unit'
        ? [`zone-heading-${target.zoneId}`]
        : [...zones.map((zone) => `zone-heading-${zone.id}`), 'add-zone-heading']
    router.replace(listHref, { scroll: false })
  }, [confirm, zones, listHref, router])

  // Focus management after mutations (design §3)
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

  function handleMoveZoneUp(zone: SeatMapZone) {
    startTransition(async () => {
      const res = await moveZoneUp(spaceId, zone.id)
      if (res.success) {
        setAnnouncement(`Moved ${zone.name} up.`)
        focusAfterSave.current = [`move-up-${zone.id}`]
      }
    })
  }

  function handleMoveZoneDown(zone: SeatMapZone) {
    startTransition(async () => {
      const res = await moveZoneDown(spaceId, zone.id)
      if (res.success) {
        setAnnouncement(`Moved ${zone.name} down.`)
        focusAfterSave.current = [`move-down-${zone.id}`]
      }
    })
  }

  if (zones.length === 0) {
    return (
      <div className="space-y-6">
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This Space has no zones yet. Start with a zone, such as &ldquo;Quiet
            desks&rdquo;. Zones group your units on the map.
          </p>
          <div className="mx-auto mt-4 max-w-md text-left">
            <ZoneForm
              mode="add"
              spaceId={spaceId}
              position={0}
              shouldFocus={false}
              onDone={(created) => {
                setAnnouncement(`Added ${created.name}.`)
                focusAfterSave.current = [`zone-heading-${created.id}`]
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="space-y-6">
        {zones.map((zone, zoneIndex) => {
          if (confirm?.kind === 'zone' && confirm.id === zone.id) {
            return (
              <ConfirmRemoval
                key={`confirm-zone-${zone.id}`}
                spaceId={spaceId}
                target={confirm}
                cancelHref={listHref}
                onSubmitted={(target) => {
                  removing.current = target
                }}
              />
            )
          }

          const count = zone.units.length
          const sortedUnits = [...zone.units].sort((a, b) =>
            a.row !== b.row ? a.row - b.row : a.col - b.col,
          )
          const freeCell = findFirstAvailableCell(zone.units, 1, zone.id) ?? {
            row: getZoneRowCount(zone.units),
            col: 0,
          }
          const nextLabel = nextSuggestedLabel(allUnits, 'seat')

          return (
            <section
              key={zone.id}
              aria-labelledby={`zone-heading-${zone.id}`}
              className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
            >
              {/* Zone Header and actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2
                    id={`zone-heading-${zone.id}`}
                    tabIndex={-1}
                    className="text-lg font-semibold wrap-anywhere text-foreground"
                  >
                    {zone.name}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    ({count} {count === 1 ? 'unit' : 'units'})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <form
                    action={moveZoneUpForm}
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleMoveZoneUp(zone)
                    }}
                    className="inline"
                  >
                    <input type="hidden" name="spaceId" value={spaceId} />
                    <input type="hidden" name="zoneId" value={zone.id} />
                    <Button
                      id={`move-up-${zone.id}`}
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${zone.name} up`}
                      disabled={zoneIndex === 0 || isPending}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                  </form>

                  <form
                    action={moveZoneDownForm}
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleMoveZoneDown(zone)
                    }}
                    className="inline"
                  >
                    <input type="hidden" name="spaceId" value={spaceId} />
                    <input type="hidden" name="zoneId" value={zone.id} />
                    <Button
                      id={`move-down-${zone.id}`}
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${zone.name} down`}
                      disabled={zoneIndex === zones.length - 1 || isPending}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </form>

                  <details
                    id={`rename-details-${zone.id}`}
                    className="group relative inline-block"
                  >
                    <summary
                      className={cn(
                        buttonVariants({ variant: 'ghost' }),
                        'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
                      )}
                    >
                      Rename<span className="sr-only"> {zone.name}</span>
                    </summary>
                    <div className="mt-2 w-72 rounded-lg border border-border bg-popover p-3 shadow-md sm:w-80">
                      <ZoneForm
                        mode="rename"
                        spaceId={spaceId}
                        zone={zone}
                        shouldFocus={false}
                        onCancel={() => {
                          const el = document.getElementById(
                            `rename-details-${zone.id}`,
                          ) as HTMLDetailsElement | null
                          if (el) el.open = false
                        }}
                        onDone={(renamed) => {
                          const el = document.getElementById(
                            `rename-details-${zone.id}`,
                          ) as HTMLDetailsElement | null
                          if (el) el.open = false
                          setAnnouncement(`Renamed zone to ${renamed.name}.`)
                          focusAfterSave.current = [`zone-heading-${zone.id}`]
                        }}
                        cancelHref={listHref}
                      />
                    </div>
                  </details>

                  <Link
                    href={`${listHref}&delete-zone=${zone.id}#confirm`}
                    className={cn(
                      buttonVariants({ variant: 'ghost' }),
                      'text-destructive',
                    )}
                  >
                    Delete<span className="sr-only"> {zone.name}</span>
                  </Link>
                </div>
              </div>

              {/* Units List */}
              {count === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This zone has no units. Use the form below to add one.
                </p>
              ) : (
                <ul
                  aria-label={`Units in ${zone.name}`}
                  className="m-0 list-none space-y-3 p-0"
                >
                  {sortedUnits.map((unit) => {
                    if (confirm?.kind === 'unit' && confirm.id === unit.id) {
                      return (
                        <li key={unit.id}>
                          <ConfirmRemoval
                            spaceId={spaceId}
                            target={confirm}
                            cancelHref={listHref}
                            onSubmitted={(target) => {
                              removing.current = target
                            }}
                          />
                        </li>
                      )
                    }

                    return (
                      <li key={unit.id}>
                        <article
                          id={`unit-${unit.id}`}
                          aria-labelledby={`unit-heading-${unit.id}`}
                          className="space-y-3 rounded-lg border border-border/80 bg-background/50 p-3 sm:p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <h3
                                id={`unit-heading-${unit.id}`}
                                tabIndex={-1}
                                className="text-base font-semibold wrap-anywhere text-foreground"
                              >
                                {unit.label}
                              </h3>
                              <p className="text-sm wrap-anywhere text-muted-foreground">
                                {unitTypeNames[unit.unitType]}
                                {unit.unitType === 'room' &&
                                  unit.capacity !== null &&
                                  ` · Capacity: ${unit.capacity} people`}
                                {` · ${describeCell(unit.row, unit.col, unit.colSpan)}`}
                                {` · ${
                                  unit.colSpan === 1
                                    ? '1 cell wide'
                                    : `${unit.colSpan} cells wide`
                                }`}
                                {` · State: ${
                                  seatStateNames[unit.seatState] ?? unit.seatState
                                }`}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`${listHref}&remove=${unit.id}#confirm`}
                                className={buttonVariants({
                                  variant: 'destructive',
                                })}
                              >
                                Remove<span className="sr-only"> {unit.label}</span>
                              </Link>
                            </div>
                          </div>

                          <details id={`edit-details-${unit.id}`} className="group">
                            <summary
                              className={cn(
                                buttonVariants({ variant: 'outline' }),
                                'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
                              )}
                            >
                              Edit<span className="sr-only"> {unit.label}</span>
                            </summary>
                            <div className="mt-3 border-t border-border pt-3">
                              <UnitForm
                                mode="edit"
                                spaceId={spaceId}
                                zoneId={zone.id}
                                zones={zones}
                                unit={unit}
                                showCoordinates
                                onCancel={() => {
                                  const el = document.getElementById(
                                    `edit-details-${unit.id}`,
                                  ) as HTMLDetailsElement | null
                                  if (el) el.open = false
                                }}
                                onDone={(saved) => {
                                  const el = document.getElementById(
                                    `edit-details-${unit.id}`,
                                  ) as HTMLDetailsElement | null
                                  if (el) el.open = false
                                  setAnnouncement(`Saved ${saved.label}.`)
                                  focusAfterSave.current = [`unit-heading-${saved.id}`]
                                }}
                                cancelHref={listHref}
                              />
                            </div>
                          </details>
                        </article>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* Add a unit to this zone */}
              <details
                id={`add-unit-details-${zone.id}`}
                open={count === 0}
                className="rounded-lg border border-dashed border-border bg-muted/20 p-3 sm:p-4"
              >
                <summary className="cursor-pointer text-sm font-medium text-foreground hover:underline">
                  Add a unit to {zone.name}
                </summary>
                <div className="mt-3 max-w-lg">
                  <UnitForm
                    mode="add"
                    spaceId={spaceId}
                    zoneId={zone.id}
                    zones={zones}
                    defaultRow={freeCell.row}
                    defaultCol={freeCell.col}
                    defaultLabel={nextLabel}
                    defaultType="seat"
                    showCoordinates
                    onDone={(created) => {
                      setAnnouncement(`Added ${created.label} to ${zone.name}.`)
                      focusAfterSave.current = [`unit-heading-${created.id}`]
                    }}
                  />
                </div>
              </details>
            </section>
          )
        })}
      </div>

      {/* Page ends with Add a zone form (design §3) */}
      <section
        aria-labelledby="add-zone-heading"
        className="space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
      >
        <h2 id="add-zone-heading" className="text-lg font-semibold text-foreground">
          Add a zone
        </h2>
        <p className="text-sm text-muted-foreground">
          Zones group your units on the map, such as &ldquo;Quiet desks&rdquo; or
          &ldquo;Standing area&rdquo;.
        </p>
        <div className="max-w-md">
          <ZoneForm
            mode="add"
            spaceId={spaceId}
            position={zones.length}
            shouldFocus={false}
            onDone={(created) => {
              setAnnouncement(`Added ${created.name}.`)
              focusAfterSave.current = [`zone-heading-${created.id}`]
            }}
          />
        </div>
      </section>
    </div>
  )
}
