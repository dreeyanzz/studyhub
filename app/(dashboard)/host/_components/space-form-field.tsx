import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import type { SpaceField } from '@/lib/validation/space'

/** What a Space form control needs to be tied to its label, hint and error. */
export type SpaceControlProps = {
  id: string
  name: SpaceField
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

type SpaceFormFieldProps = {
  /** The spaceSchema key, which is also the control's name (design §2.3). */
  name: SpaceField
  label: string
  hint?: string
  errors?: string[]
  /** Renders the input or textarea with the props that connect it to the rest. */
  children: (control: SpaceControlProps) => ReactNode
}

// A labelled control whose hint and first error are announced with it, as in
// STORY-03's FormField: aria-invalid and aria-describedby (STORY-05 design §3.3).
// It takes a render function, so the same field wraps an input or the textarea.
export function SpaceFormField({
  name,
  label,
  hint,
  errors,
  children,
}: SpaceFormFieldProps) {
  const id = `space-${name}`
  const error = errors?.[0]
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        name,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
