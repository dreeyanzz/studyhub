'use client'

import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { loginSchema } from '@/lib/validation/auth'

import { login } from '../../actions'
import { FormField } from '../../_components/form-field'
import { useAuthForm } from '../../_components/use-auth-form'

export function LoginForm({ returnUrl }: { returnUrl: string }) {
  const { formProps, state, pending, errors, showServerMessage } = useAuthForm(
    loginSchema,
    login,
  )
  // Controlled, so a failed login keeps what was typed without changing the input's
  // default value, which Base UI warns about (#146). A form posted without JavaScript
  // starts from the email the action sent back.
  const [email, setEmail] = useState(state.values?.email ?? '')

  return (
    <form {...formProps} className="flex flex-col gap-4">
      {showServerMessage && state.formError && (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="returnUrl" value={returnUrl} />
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        errors={errors.email}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        errors={errors.password}
      />
      <Button
        type="submit"
        className="mt-1 h-auto min-h-12 w-full rounded-xl bg-gradient-to-r from-primary to-forest-mid py-3 font-semibold whitespace-normal text-white shadow-sm transition-all duration-200 hover:from-primary-hover hover:to-forest-deep hover:shadow-card"
        disabled={pending}
        focusableWhenDisabled
      >
        {pending ? 'Logging in…' : 'Log in'}
      </Button>
    </form>
  )
}
