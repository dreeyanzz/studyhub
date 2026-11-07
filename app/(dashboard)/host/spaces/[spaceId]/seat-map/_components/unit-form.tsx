'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SeatMapUnit, SeatMapZone, UnitType } from '@/lib/seat-map/grid'

import { addUnit, updateUnit, type SeatMapActionState } from '../actions'

/** A native select styled like STORY-02's Input, until the design system has a Select (design §3). */
export const selectClassName =
  'h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive md:text-sm'

export const unitTypeNames: Record<UnitType, string> = {
  seat: 'Seat',
  standing_desk: 'Standing desk',
  room: 'Whole room',
}

/** What a control needs to be tied to its label and its error. */
type FieldControlProps = {
  id: string
  name: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

type BaseUnitFormProps = {
  spaceId: string
  zoneId: string
  zones?: SeatMapZone[]
  showCoordinates?: boolean
  /** Called once the unit is saved, with its id and its label as saved. */
  onDone?: (unit: { id: string; label: string }) => void
  onCancel?: () => void
  cancelHref?: string
}

type EditUnitFormProps = BaseUnitFormProps & {
  mode?: 'edit'
  unit: SeatMapUnit
}

type AddUnitFormProps = BaseUnitFormProps & {
  mode: 'add'
  unit?: never
  defaultLabel?: string
  defaultType?: UnitType
  defaultRow?: number
  defaultCol?: number
}

export type UnitFormProps = EditUnitFormProps | AddUnitFormProps

/**
 * Adds or edits a unit's label, type, coordinates, and a whole room's capacity and width
 * (STORY-07 design §3). In the grid view, coordinates are fixed (or moved via Move mode).
 * In TSK-07.7's list view, row and column are native selects (reading from 1, submitting from 0).
 * It saves through addUnit or updateUnit, so overlaps (23P01) and duplicate labels (23505)
 * come back as messages.
 */
export function UnitForm(props: UnitFormProps) {
  const isEdit = props.mode !== 'add'
  const action = isEdit ? updateUnit : addUnit
  const [state, formAction, pending] = useActionState<SeatMapActionState, FormData>(
    action,
    {},
  )
  const initialType: UnitType = isEdit
    ? props.unit.unitType
    : (props.defaultType ?? 'seat')
  const [unitType, setUnitType] = useState<UnitType>(initialType)
  const id = useId()
  const onDoneRef = useRef(props.onDone)
  useEffect(() => {
    onDoneRef.current = props.onDone
  })

  // Runs once per answer from the action: each answer is a new state object.
  useEffect(() => {
    const saved = state.success ? (state.data as { id?: string; label?: string }) : null
    if (saved?.id) onDoneRef.current?.({ id: saved.id, label: saved.label ?? '' })
  }, [state])

  const errors = state.fieldErrors ?? {}
  const fieldError = (name: string) => errors[name]?.[0]
  const isRoom = unitType === 'room'
  const value = (name: string, fallback: string) =>
    typeof state.values?.[name] === 'string' ? (state.values[name] as string) : fallback

  const defaultLabel = isEdit ? props.unit.label : (props.defaultLabel ?? '')
  const initialRow = isEdit ? props.unit.row : (props.defaultRow ?? 0)
  const initialCol = isEdit ? props.unit.col : (props.defaultCol ?? 0)
  const initialCapacity = isEdit ? String(props.unit.capacity ?? 4) : '4'
  const initialColSpan = isEdit
    ? String(props.unit.unitType === 'room' ? props.unit.colSpan : 2)
    : '2'

  function field(
    name: string,
    label: string,
    control: (aria: FieldControlProps) => ReactNode,
  ) {
    const error = fieldError(name)
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-${name}`}>{label}</Label>
        {control({
          id: `${id}-${name}`,
          name,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `${id}-${name}-error` : undefined,
        })}
        {error && (
          <p id={`${id}-${name}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  // A message the fields don't show, such as an overlap or a permission refusal.
  const shownFieldErrors = [
    'label',
    'unitType',
    'capacity',
    'colSpan',
    'row',
    'col',
    'zoneId',
  ]
  const formError =
    state.formError &&
    !shownFieldErrors.some((name) => fieldError(name) === state.formError)
      ? state.formError
      : undefined

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {!pending && formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="spaceId" value={props.spaceId} />
      {isEdit && <input type="hidden" name="unitId" value={props.unit.id} />}

      {props.zones && props.zones.length > 1 ? (
        field('zoneId', 'Zone', (aria) => (
          <select
            {...aria}
            className={selectClassName}
            defaultValue={value('zoneId', props.zoneId)}
          >
            {props.zones!.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        ))
      ) : (
        <input type="hidden" name="zoneId" value={props.zoneId} />
      )}

      {props.showCoordinates ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('row', 'Row', (aria) => (
            <select
              {...aria}
              className={selectClassName}
              key={`row-${value('row', String(initialRow))}`}
              defaultValue={value('row', String(initialRow))}
            >
              {Array.from({ length: 50 }, (_, i) => (
                <option key={i} value={i}>
                  Row {i + 1}
                </option>
              ))}
            </select>
          ))}
          {field('col', 'Column', (aria) => (
            <select
              {...aria}
              className={selectClassName}
              key={`col-${value('col', String(initialCol))}`}
              defaultValue={value('col', String(initialCol))}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <option key={i} value={i}>
                  Column {i + 1}
                </option>
              ))}
            </select>
          ))}
        </div>
      ) : (
        <>
          <input type="hidden" name="row" value={initialRow} />
          <input type="hidden" name="col" value={initialCol} />
        </>
      )}

      {field('label', 'Label', (aria) => (
        <Input
          {...aria}
          key={`label-${value('label', defaultLabel)}`}
          defaultValue={value('label', defaultLabel)}
          maxLength={12}
          required
        />
      ))}

      {field('unitType', 'Type', (aria) => (
        <select
          {...aria}
          className={selectClassName}
          value={unitType}
          onChange={(event) => setUnitType(event.target.value as UnitType)}
        >
          {(Object.keys(unitTypeNames) as UnitType[]).map((type) => (
            <option key={type} value={type}>
              {unitTypeNames[type]}
            </option>
          ))}
        </select>
      ))}

      {isRoom ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('capacity', 'Capacity (people)', (aria) => (
            <Input
              {...aria}
              key={`capacity-${value('capacity', initialCapacity)}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              defaultValue={value('capacity', initialCapacity)}
              required
            />
          ))}
          {field('colSpan', 'Width', (aria) => (
            <select
              {...aria}
              className={selectClassName}
              key={`span-${value('colSpan', initialColSpan)}`}
              defaultValue={value('colSpan', initialColSpan)}
            >
              <option value="2">2 cells</option>
              <option value="3">3 cells</option>
            </select>
          ))}
        </div>
      ) : (
        <input type="hidden" name="colSpan" value={1} />
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} focusableWhenDisabled>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add unit'}
        </Button>
        {props.onCancel && (
          <Button type="button" variant="outline" onClick={props.onCancel}>
            Cancel
          </Button>
        )}
        {!props.onCancel && props.cancelHref && (
          <Link
            href={props.cancelHref}
            className={buttonVariants({ variant: 'outline' })}
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  )
}
