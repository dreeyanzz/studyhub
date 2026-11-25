'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

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
}

const initialState: ProfileFormState = {}

/**
 * ProfileForm component (STORY-04).
 * Client Component pre-filled with Seeker's profile details.
 * Validates inputs using profileUpdateSchema in browser and server,
 * executes updateProfile Server Action, and renders accessible status alerts.
 */
export function ProfileForm({ profile }: ProfileFormProps) {
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl font-semibold">Profile Details</h2>
        </CardTitle>
        <CardDescription>View and update your personal information.</CardDescription>
      </CardHeader>
      <form ref={formRef} action={formAction} onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {activeFormStatus && (
            <Alert
              variant={activeFormStatus.type === 'error' ? 'destructive' : 'default'}
              role={activeFormStatus.type === 'error' ? 'alert' : 'status'}
            >
              <AlertDescription>{activeFormStatus.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
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
              className="w-full"
            />
            {activeFieldErrors.full_name && (
              <p id="full_name-error" className="text-xs font-medium text-destructive">
                {activeFieldErrors.full_name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
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
              className="w-full"
            />
            {activeFieldErrors.phone_number && (
              <p id="phone_number-error" className="text-xs font-medium text-destructive">
                {activeFieldErrors.phone_number}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-2">
          <Button
            type="submit"
            variant="default"
            size="default"
            disabled={isPending}
            focusableWhenDisabled
          >
            {isPending ? 'Saving changes…' : 'Save Profile'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
