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
    <form {...formProps} className="flex flex-col gap-5">
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
      <Button type="submit" disabled={pending} focusableWhenDisabled>
        {pending ? 'Logging in…' : 'Log in'}
      </Button>
    </form>
  )
}
