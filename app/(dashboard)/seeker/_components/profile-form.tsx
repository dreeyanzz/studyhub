'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Mail, Phone, User } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { profileUpdateSchema } from '@/lib/validation/profile'

import { ProfileFormState, updateProfile } from '../actions'

interface ProfileFormProps {
  profile: {
    full_name: string | null
    phone_number: string | null
  }
  email?: string | null
}

const initialState: ProfileFormState = {}

/**
 * ProfileForm component (STORY-04).
 * Client Component pre-filled with Seeker's profile details.
 * Validates inputs using profileUpdateSchema in browser and server,
 * executes updateProfile Server Action, and renders accessible status alerts.
 */
export function ProfileForm({ profile, email = null }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfile, initialState)

  const [fullName, setFullName] = useState(profile.full_name || '')
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number || '')
  const [clientFieldErrors, setClientFieldErrors] = useState<{
    full_name?: string
    phone_number?: string
  } | null>(null)
  const [clientFormError, setClientFormError] = useState<string | null>(null)

  const formRef = useRef<HTMLFormElement>(null)

  // Derive active field errors (client validation overrides server errors)
  const activeFieldErrors = clientFieldErrors ?? {
    full_name: state.fieldErrors?.full_name?.[0],
    phone_number: state.fieldErrors?.phone_number?.[0],
  }

  // Derive active form status alert
  const activeFormStatus: { type: 'success' | 'error'; message: string } | null =
    clientFormError
      ? { type: 'error', message: clientFormError }
      : state.formError
        ? { type: 'error', message: state.formError }
        : state.fieldErrors?.full_name || state.fieldErrors?.phone_number
          ? {
              type: 'error',
              message: 'Please correct the errors in the form before saving.',
            }
          : state.successMessage
            ? { type: 'success', message: state.successMessage }
            : null

  // Moves focus to the first field in error after every failed save, as STORY-03's
  // useAuthForm does. It depends on the error objects, not their text, so a second
  // identical failure still moves focus.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [state, clientFieldErrors])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Validate with Zod schema in the browser before action submission
    const result = profileUpdateSchema.safeParse({
      full_name: fullName,
      phone_number: phoneNumber,
    })

    if (!result.success) {
      e.preventDefault()
      const formattedErrors: { full_name?: string; phone_number?: string } = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0] === 'full_name' && !formattedErrors.full_name) {
          formattedErrors.full_name = issue.message
        }
        if (issue.path[0] === 'phone_number' && !formattedErrors.phone_number) {
          formattedErrors.phone_number = issue.message
        }
      })
      setClientFieldErrors(formattedErrors)
      setClientFormError('Please correct the errors in the form before saving.')
    } else {
      setClientFieldErrors(null)
      setClientFormError(null)
    }
  }

  const displayName = fullName.trim() || profile.full_name || 'Seeker Account'
  const initial = displayName.charAt(0).toUpperCase()
  const hasPhone = Boolean(phoneNumber.trim())

  return (
    <Card className="w-full gap-0 overflow-hidden rounded-3xl border-border/80 bg-card py-0 shadow-card">
      {/* Botanical identity header strip */}
      <div className="border-b border-border/70 bg-gradient-to-br from-secondary/75 via-surface-subtle to-brass-soft/50 px-6 py-5">
        <div className="flex items-center gap-3.5">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-forest-mid font-heading text-lg font-bold text-white shadow-sm"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-base font-bold text-foreground">
              {displayName}
            </p>
            {email ? (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{email}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">Worq Seeker Profile</p>
            )}
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-white/85 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            <CheckCircle2 aria-hidden="true" className="size-3" />
            <span>Profile active</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Phone aria-hidden="true" className="size-3 text-primary" />
            <span>{hasPhone ? 'Contact phone saved' : 'Phone optional'}</span>
          </span>
        </div>
      </div>

      <CardHeader className="px-6 pt-5 pb-2">
        <CardTitle>
          <h2 className="font-heading text-xl font-bold tracking-[-0.02em]">
            Profile Details
          </h2>
        </CardTitle>
        <CardDescription>
          Hosts see your name on check-in passes. Keep your contact info current.
        </CardDescription>
      </CardHeader>

      <form ref={formRef} action={formAction} onSubmit={handleSubmit}>
        <CardContent className="space-y-4 px-6 py-4">
          {activeFormStatus && (
            <Alert
              variant={activeFormStatus.type === 'error' ? 'destructive' : 'default'}
              role={activeFormStatus.type === 'error' ? 'alert' : 'status'}
              className={
                activeFormStatus.type === 'success'
                  ? 'border-primary/25 bg-secondary/55'
                  : undefined
              }
            >
              <AlertDescription>{activeFormStatus.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="full_name" className="px-1 font-semibold">
              Full Name
            </Label>
            <div className="relative">
              <User
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-primary/80"
              />
              <Input
                id="full_name"
                name="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={!!activeFieldErrors.full_name}
                aria-describedby={
                  activeFieldErrors.full_name ? 'full_name-error' : undefined
                }
                placeholder="e.g. Alex Seeker"
                className="w-full rounded-xl bg-surface-subtle/75 pr-4 pl-10 focus-visible:bg-card"
              />
            </div>
            {activeFieldErrors.full_name && (
              <p id="full_name-error" className="text-xs font-medium text-destructive">
                {activeFieldErrors.full_name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number" className="px-1 font-semibold">
              Phone Number
            </Label>
            <div className="relative">
              <Phone
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-primary/80"
              />
              <Input
                id="phone_number"
                name="phone_number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                aria-invalid={!!activeFieldErrors.phone_number}
                aria-describedby={
                  activeFieldErrors.phone_number ? 'phone_number-error' : undefined
                }
                placeholder="e.g. +63 (912) 345-6789"
                className="w-full rounded-xl bg-surface-subtle/75 pr-4 pl-10 focus-visible:bg-card"
              />
            </div>
            {activeFieldErrors.phone_number && (
              <p id="phone_number-error" className="text-xs font-medium text-destructive">
                {activeFieldErrors.phone_number}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="border-t border-border/70 bg-surface-subtle/40 px-6 py-4">
          {/* h-auto, min-w-0 and whitespace-normal let the label wrap in the narrow right
              column at 200% text, so the button stays inside its card (#434). */}
          <Button
            type="submit"
            variant="default"
            size="default"
            disabled={isPending}
            focusableWhenDisabled
            className="h-auto min-h-12 w-full max-w-full min-w-12 rounded-xl bg-gradient-to-r from-primary to-forest-mid py-2.5 font-semibold whitespace-normal text-white shadow-sm hover:from-primary-hover hover:to-forest-deep sm:px-6"
          >
            {isPending ? 'Saving changes…' : 'Save Profile'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
