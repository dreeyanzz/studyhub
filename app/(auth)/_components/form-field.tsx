import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FormFieldProps = ComponentProps<typeof Input> & {
  /** Also the input's name, which the Zod schema reads. */
  id: string
  label: string
  hint?: string
  errors?: string[]
}

// A labelled input whose hint and first error are announced with it
// (STORY-03 design §3: aria-invalid and aria-describedby).
export function FormField({ id, label, hint, errors, ...inputProps }: FormFieldProps) {
  const error = errors?.[0]
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
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
