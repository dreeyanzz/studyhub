'use client'

import { useEffect, useRef, useState } from 'react'
import { profileUpdateSchema } from '@/lib/validation/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ProfileFormProps {
  profile: {
    full_name: string | null
    phone_number: string | null
  }
}

/**
 * ProfileForm component (STORY-04).
 * Client Component pre-filled with Seeker's profile details.
 * Validates inputs using profileUpdateSchema in browser and handles aria accessibility attributes.
 */
export function ProfileForm({ profile }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number || '')
  const [fieldErrors, setFieldErrors] = useState<{
    full_name?: string
    phone_number?: string
  }>({})
  const [formStatus, setFormStatus] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Moves focus to the first field in error, as STORY-03's forms do.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [fieldErrors])

  const handleValidateAndSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Nothing is sent until TSK-04.4 wires updateProfile: a form without an action
    // would submit the name and phone number in the page's URL.
    e.preventDefault()

    // Validate with Zod schema in the browser before action submission
    const result = profileUpdateSchema.safeParse({
      full_name: fullName,
      phone_number: phoneNumber,
    })

    if (!result.success) {
      const formattedErrors: { full_name?: string; phone_number?: string } = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0] === 'full_name' && !formattedErrors.full_name) {
          formattedErrors.full_name = issue.message
        }
        if (issue.path[0] === 'phone_number' && !formattedErrors.phone_number) {
          formattedErrors.phone_number = issue.message
        }
      })
      setFieldErrors(formattedErrors)
      setFormStatus({
        type: 'error',
        message: 'Please correct the errors in the form before saving.',
      })
      return
    }

    setFieldErrors({})
    setFormStatus(null)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl font-semibold">Profile Details</h2>
        </CardTitle>
        <CardDescription>View and update your personal information.</CardDescription>
      </CardHeader>
      <form ref={formRef} onSubmit={handleValidateAndSubmit}>
        <CardContent className="space-y-4">
          {formStatus && (
            <Alert
              variant={formStatus.type === 'error' ? 'destructive' : 'default'}
              role={formStatus.type === 'error' ? 'alert' : 'status'}
            >
              <AlertDescription>{formStatus.message}</AlertDescription>
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
              aria-invalid={!!fieldErrors.full_name}
              aria-describedby={fieldErrors.full_name ? 'full_name-error' : undefined}
              placeholder="e.g. Alex Seeker"
              className="w-full"
            />
            {fieldErrors.full_name && (
              <p id="full_name-error" className="text-xs font-medium text-destructive">
                {fieldErrors.full_name}
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
              aria-invalid={!!fieldErrors.phone_number}
              aria-describedby={
                fieldErrors.phone_number ? 'phone_number-error' : undefined
              }
              placeholder="e.g. +63 (912) 345-6789"
              className="w-full"
            />
            {fieldErrors.phone_number && (
              <p id="phone_number-error" className="text-xs font-medium text-destructive">
                {fieldErrors.phone_number}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-2">
          <Button type="submit" variant="default" size="default">
            Save Profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
