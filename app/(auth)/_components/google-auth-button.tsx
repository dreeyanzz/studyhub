'use client'

import { useActionState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { AuthSource, RegistrationRole } from '@/lib/validation/auth'

import { signInWithGoogle } from '../actions'

// Full-width "Continue with Google" Server Action form shared by /login and
// /register (STORY-21, D-010, D-095). Works with or without JavaScript.
export function GoogleAuthButton({
  source,
  returnUrl = '',
  defaultRole,
}: {
  source: AuthSource
  returnUrl?: string
  defaultRole?: RegistrationRole
}) {
  const [state, formAction, pending] = useActionState(signInWithGoogle, {})

  return (
    <div className="flex flex-col gap-4">
      {!pending && state.formError && (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      <form action={formAction}>
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="returnUrl" value={returnUrl} />
        {defaultRole && <input type="hidden" name="role" value={defaultRole} />}
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          focusableWhenDisabled
          className="h-auto min-h-12 w-full justify-center gap-3 rounded-xl border-border bg-card py-3 font-semibold whitespace-normal shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-surface-subtle"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="size-4.5 shrink-0"
          >
            <path
              d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
              fill="#EA4335"
            />
          </svg>
          <span>{pending ? 'Redirecting to Google…' : 'Continue with Google'}</span>
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>or continue with email</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
    </div>
  )
}
