'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type FormFieldProps = ComponentProps<typeof Input> & {
  /** Also the input's name, which the Zod schema reads. */
  id: string
  label: string
  hint?: string
  errors?: string[]
}

// A labelled input whose hint and first error are announced with it
// (STORY-03 design §3: aria-invalid and aria-describedby).
export function FormField({
  id,
  label,
  hint,
  errors,
  type,
  className,
  ...inputProps
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const effectiveType = isPassword && showPassword ? 'text' : type
  const error = errors?.[0]
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="px-1 text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={effectiveType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'rounded-full border-transparent bg-muted/85 px-4 text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background',
            isPassword && 'pr-12',
            className,
          )}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute top-0 right-0 flex size-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="px-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="px-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
