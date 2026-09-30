'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { spaceIdSchema, spaceSchema } from '@/lib/validation/space'

import type { SpaceFormState, SpaceFormValues } from '../actions'
import { SpaceFormField } from './space-form-field'

type SpaceAction = (state: SpaceFormState, formData: FormData) => Promise<SpaceFormState>

type SpaceFormProps =
  | { mode: 'create'; action: SpaceAction }
  | {
      mode: 'edit'
      action: SpaceAction
      spaceId: string
      initialValues: SpaceFormValues
    }

// The Input primitive's look, for the one multi-line field. STORY-02 ships no
// Textarea, and this story does not add one (design §0).
const textareaClassName =
  'min-h-32 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive md:text-sm'

/**
 * The create and edit form for a Space (STORY-05 design §3.3). spaceSchema runs here
 * before the Server Action, which runs it again. Without JavaScript the form still
 * posts, and the action's checks and RLS still apply.
 */
export function SpaceForm(props: SpaceFormProps) {
  const [state, formAction, pending] = useActionState(props.action, {})
  // What the browser check found; it replaces the server's answer until the next
  // attempt reaches the server.
  const [clientState, setClientState] = useState<SpaceFormState>()
  const formRef = useRef<HTMLFormElement>(null)

  // After every failed attempt, in the browser or on the server, focus moves to the
  // first field in error. It depends on the state objects, not their text, so a
  // second identical failure still moves focus.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [state, clientState])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // A second press while the first save runs does nothing.
    if (pending) {
      event.preventDefault()
      return
    }
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const fields = spaceSchema.safeParse(data)
    // The edit form's hidden id comes from the server, so this only stops a
    // tampered one (design §2.4).
    const idError =
      props.mode === 'edit' && !spaceIdSchema.safeParse(data.spaceId).success
        ? 'We could not find that Space.'
        : undefined
    if (fields.success && !idError) {
      setClientState(undefined)
      return
    }
    event.preventDefault()
    setClientState({
      fieldErrors: fields.success ? undefined : z.flattenError(fields.error).fieldErrors,
      formError: idError,
    })
  }

  const errors = (clientState ?? state).fieldErrors ?? {}
  // The server's message is hidden while a new attempt runs, so a repeated message
  // is inserted again and its role="alert" announces it again.
  const formError = clientState
    ? clientState.formError
    : pending
      ? undefined
      : state.formError
  // After a failed save the form shows what the Host typed, not the saved values.
  const values = state.values ?? (props.mode === 'edit' ? props.initialValues : {})
  const creating = props.mode === 'create'

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      {props.mode === 'edit' && (
        <input type="hidden" name="spaceId" value={props.spaceId} />
      )}
      <SpaceFormField name="name" label="Space name" errors={errors.name}>
        {(control) => (
          <Input
            {...control}
            type="text"
            autoComplete="organization"
            required
            maxLength={100}
            defaultValue={values.name}
          />
        )}
      </SpaceFormField>
      <SpaceFormField name="address" label="Address" errors={errors.address}>
        {(control) => (
          <Input
            {...control}
            type="text"
            autoComplete="street-address"
            required
            maxLength={200}
            defaultValue={values.address}
          />
        )}
      </SpaceFormField>
      <SpaceFormField
        name="description"
        label="Description"
        hint="Optional, up to 2,000 characters."
        errors={errors.description}
      >
        {(control) => (
          <textarea
            {...control}
            rows={4}
            maxLength={2000}
            defaultValue={values.description}
            className={textareaClassName}
          />
        )}
      </SpaceFormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <SpaceFormField
          name="opensAt"
          label="Opening time"
          hint="The same hours apply every day."
          errors={errors.opensAt}
        >
          {(control) => (
            <Input {...control} type="time" required defaultValue={values.opensAt} />
          )}
        </SpaceFormField>
        {/* D-027: no rule compares the two times, so the hint explains both cases. */}
        <SpaceFormField
          name="closesAt"
          label="Closing time"
          hint="If you close after midnight, pick a time earlier than the opening time. For 24 hours, use the same time for both."
          errors={errors.closesAt}
        >
          {(control) => (
            <Input {...control} type="time" required defaultValue={values.closesAt} />
          )}
        </SpaceFormField>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending} focusableWhenDisabled>
          {creating
            ? pending
              ? 'Creating Space…'
              : 'Create Space'
            : pending
              ? 'Saving changes…'
              : 'Save changes'}
        </Button>
        {!creating && (
          <Link href="/host" className={buttonVariants({ variant: 'outline' })}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  )
}
