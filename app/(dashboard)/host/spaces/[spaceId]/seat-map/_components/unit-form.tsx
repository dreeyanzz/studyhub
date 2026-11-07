'use client'

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SeatMapUnit, UnitType } from '@/lib/seat-map/grid'

import { updateUnit, type SeatMapActionState } from '../actions'

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

type UnitFormProps = {
  spaceId: string
  zoneId: string
  unit: SeatMapUnit
  /** Called once the unit is saved, with its id and its label as saved. */
  onDone: (unit: { id: string; label: string }) => void
  onCancel: () => void
}

/**
 * Edits a unit's label, type, and a whole room's capacity and width (STORY-07 design
 * §3). It keeps the unit where it is: the grid moves units with Move, and TSK-07.7's
 * list view adds its row and column. It saves through updateUnit, so overlaps (23P01)
 * and duplicate labels (23505) come back as messages.
 */
export function UnitForm({ spaceId, zoneId, unit, onDone, onCancel }: UnitFormProps) {
  const [state, formAction, pending] = useActionState<SeatMapActionState, FormData>(
    updateUnit,
    {},
  )
  const [unitType, setUnitType] = useState<UnitType>(unit.unitType)
  const id = useId()
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  // Runs once per answer from the action: each answer is a new state object.
  useEffect(() => {
    const saved = state.success ? (state.data as { id?: string; label?: string }) : null
    if (saved?.id) onDoneRef.current({ id: saved.id, label: saved.label ?? '' })
  }, [state])

  const errors = state.fieldErrors ?? {}
  const fieldError = (name: string) => errors[name]?.[0]
  const isRoom = unitType === 'room'
  const value = (name: string, fallback: string) =>
    typeof state.values?.[name] === 'string' ? (state.values[name] as string) : fallback

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
  const shownFieldErrors = ['label', 'unitType', 'capacity', 'colSpan']
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
      <input type="hidden" name="spaceId" value={spaceId} />
      <input type="hidden" name="unitId" value={unit.id} />
      <input type="hidden" name="zoneId" value={zoneId} />
      <input type="hidden" name="row" value={unit.row} />
      <input type="hidden" name="col" value={unit.col} />
      {!isRoom && <input type="hidden" name="colSpan" value={1} />}

      {field('label', 'Label', (aria) => (
        <Input
          {...aria}
          key={`label-${value('label', unit.label)}`}
          defaultValue={value('label', unit.label)}
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

      {isRoom && (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('capacity', 'Capacity (people)', (aria) => (
            <Input
              {...aria}
              key={`capacity-${value('capacity', String(unit.capacity ?? ''))}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              defaultValue={value('capacity', String(unit.capacity ?? 4))}
              required
            />
          ))}
          {field('colSpan', 'Width', (aria) => (
            <select
              {...aria}
              className={selectClassName}
              key={`span-${value('colSpan', String(unit.colSpan))}`}
              defaultValue={value(
                'colSpan',
                String(unit.unitType === 'room' ? unit.colSpan : 2),
              )}
            >
              <option value="2">2 cells</option>
              <option value="3">3 cells</option>
            </select>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} focusableWhenDisabled>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
