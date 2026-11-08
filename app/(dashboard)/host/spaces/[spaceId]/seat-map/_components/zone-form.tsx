'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useRef } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { createZone, renameZone, type SeatMapActionState } from '../actions'

type ZoneFormProps = {
  spaceId: string
  /** Called once the zone is saved, with its id and its name as saved. */
  onDone?: (zone: { id: string; name: string }) => void
  /** Shows a Cancel button that closes the form without saving. */
  onCancel?: () => void
  cancelHref?: string
  shouldFocus?: boolean
} & (
  | { mode: 'add'; /** Where the new zone goes: after the last one. */ position: number }
  | { mode: 'rename'; zone: { id: string; name: string } }
)

/**
 * Adds a zone or renames one (STORY-07 design §3). The grid view opens it from the
 * toolbar and from a zone's header; TSK-07.7's list view reuses it. It saves through
 * createZone or renameZone, so the database's rules (D-062) and RLS decide.
 */
export function ZoneForm(props: ZoneFormProps) {
  const action = props.mode === 'add' ? createZone : renameZone
  const [state, formAction, pending] = useActionState<SeatMapActionState, FormData>(
    action,
    {},
  )
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  // The latest onDone, so a parent that passes a new function each render doesn't
  // make the success effect below run again.
  const onDoneRef = useRef(props.onDone)
  useEffect(() => {
    onDoneRef.current = props.onDone
  })

  // Focus the name as the form opens, so a keyboard user can type straight away.
  useEffect(() => {
    if (props.shouldFocus !== false) {
      inputRef.current?.focus()
    }
  }, [props.shouldFocus])

  // Runs once per answer from the action: each answer is a new state object.
  useEffect(() => {
    const zone = state.success ? (state.data as { id?: string; name?: string }) : null
    if (zone?.id) onDoneRef.current?.({ id: zone.id, name: zone.name ?? '' })
  }, [state])

  const nameError = state.fieldErrors?.name?.[0]
  const savedName =
    typeof state.values?.name === 'string'
      ? state.values.name
      : props.mode === 'rename'
        ? props.zone.name
        : ''

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      {!pending && state.formError && !nameError && (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="spaceId" value={props.spaceId} />
      {props.mode === 'add' ? (
        <input type="hidden" name="position" value={props.position} />
      ) : (
        <input type="hidden" name="zoneId" value={props.zone.id} />
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>
          {props.mode === 'add' ? 'New zone name' : `New name for ${props.zone.name}`}
        </Label>
        <Input
          ref={inputRef}
          id={inputId}
          name="name"
          // A new key resets the field to what the server saw after each attempt.
          key={savedName}
          defaultValue={savedName}
          maxLength={60}
          required
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${inputId}-error` : undefined}
          placeholder={props.mode === 'add' ? 'Quiet desks' : undefined}
        />
        {nameError && (
          <p id={`${inputId}-error`} className="text-sm text-destructive">
            {nameError}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} focusableWhenDisabled>
          {pending ? 'Saving…' : props.mode === 'add' ? 'Add zone' : 'Save name'}
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
