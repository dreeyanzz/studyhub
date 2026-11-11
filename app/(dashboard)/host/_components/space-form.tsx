'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WAIT_WINDOW_OPTIONS } from '@/lib/validation/reservation'
import type { PriceTier } from '@/lib/validation/search'
import { spaceIdSchema, spaceSchema, type SpaceField } from '@/lib/validation/space'

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

// A native select styled like STORY-02's Input for the wait window picker (design §3).
const selectClassName =
  'h-12 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive md:text-sm'

// The four price tiers, in order, with the words Seekers see on pins and cards
// (STORY-08 design §3). One per Space, so a radio group rather than checkboxes.
const priceTierOptions: { value: PriceTier; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'budget', label: 'Budget' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
]

// What a new Space starts with: a one-hour wait window (D-067) and the Budget tier,
// the column's default (STORY-08 design §2).
const createDefaults: SpaceFormValues = {
  maxWaitWindowMinutes: '60',
  priceTier: 'budget',
}

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
  // What the fields show: the saved values when editing, then what the Host types.
  // Controlled, so a failed save keeps the typed values without changing an input's
  // default value, which Base UI warns about (#146). A form posted without JavaScript
  // starts from the values the action sent back.
  const [values, setValues] = useState<SpaceFormValues>(
    () =>
      state.values ??
      (props.mode === 'edit'
        ? { ...createDefaults, ...props.initialValues }
        : createDefaults),
  )
  const formRef = useRef<HTMLFormElement>(null)

  // The value and change handler that tie one field to `values`.
  function bind(field: SpaceField) {
    return {
      value: values[field] ?? '',
      onChange: (event: { target: { value: string } }) =>
        setValues((current) => ({ ...current, [field]: event.target.value })),
    }
  }

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
            {...bind('name')}
            type="text"
            autoComplete="organization"
            required
            maxLength={100}
          />
        )}
      </SpaceFormField>
      <SpaceFormField name="address" label="Address" errors={errors.address}>
        {(control) => (
          <Input
            {...control}
            {...bind('address')}
            type="text"
            autoComplete="street-address"
            required
            maxLength={200}
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
            {...bind('description')}
            rows={4}
            maxLength={2000}
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
          {(control) => <Input {...control} {...bind('opensAt')} type="time" required />}
        </SpaceFormField>
        {/* D-027: no rule compares the two times, so the hint explains both cases. */}
        <SpaceFormField
          name="closesAt"
          label="Closing time"
          hint="If you close after midnight, pick a time earlier than the opening time. For 24 hours, use the same time for both."
          errors={errors.closesAt}
        >
          {(control) => <Input {...control} {...bind('closesAt')} type="time" required />}
        </SpaceFormField>
      </div>
      <SpaceFormField
        name="maxWaitWindowMinutes"
        label="Longest wait window"
        hint="Seekers can ask you to keep a paid unit for up to this long while they travel."
        errors={errors.maxWaitWindowMinutes}
      >
        {(control) => (
          <select
            {...control}
            {...bind('maxWaitWindowMinutes')}
            className={selectClassName}
          >
            {WAIT_WINDOW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </SpaceFormField>
      {/* One tier per Space (STORY-08 design §3). ARIA puts the invalid state on the
          radiogroup, not on each radio (as in RegisterForm). tabIndex={-1} allows
          the error-focus effect to programmatically focus the fieldset if invalid. */}
      <fieldset
        role="radiogroup"
        tabIndex={-1}
        aria-labelledby="space-priceTier-legend"
        aria-invalid={errors.priceTier?.[0] ? true : undefined}
        aria-describedby={
          ['space-priceTier-hint', errors.priceTier?.[0] && 'space-priceTier-error']
            .filter(Boolean)
            .join(' ') || undefined
        }
        className="flex flex-col gap-2 outline-none"
      >
        <legend
          id="space-priceTier-legend"
          className="mb-2 text-sm leading-none font-medium"
        >
          Price tier
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {priceTierOptions.map((option) => (
            <label
              key={option.value}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-sm has-checked:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="priceTier"
                value={option.value}
                checked={values.priceTier === option.value}
                onChange={(event) =>
                  setValues((current) => ({ ...current, priceTier: event.target.value }))
                }
                className="size-4 accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
        <p id="space-priceTier-hint" className="text-sm text-muted-foreground">
          Seekers see this on your map pin and can filter by it.
        </p>
        {errors.priceTier?.[0] && (
          <p id="space-priceTier-error" className="text-sm text-destructive">
            {errors.priceTier[0]}
          </p>
        )}
      </fieldset>
      {/* The map pin (STORY-08 design §3). Optional, but both or neither: the schema
          refuses one coordinate on its own. A Space with no pin is left off the map. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm leading-none font-medium">Map pin</legend>
        <p className="text-sm text-muted-foreground">
          Optional. Without a pin, Seekers won&apos;t find your Space on the map. To get
          the numbers, right-click your Space on openstreetmap.org, choose Show address,
          and copy the two numbers from the search box.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <SpaceFormField
            name="latitude"
            label="Latitude"
            hint="For example, 10.3157"
            errors={errors.latitude}
          >
            {(control) => (
              <Input {...control} {...bind('latitude')} type="text" inputMode="decimal" />
            )}
          </SpaceFormField>
          <SpaceFormField
            name="longitude"
            label="Longitude"
            hint="For example, 123.8854"
            errors={errors.longitude}
          >
            {(control) => (
              <Input
                {...control}
                {...bind('longitude')}
                type="text"
                inputMode="decimal"
              />
            )}
          </SpaceFormField>
        </div>
      </fieldset>
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
