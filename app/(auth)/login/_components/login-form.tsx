'use client'

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
        defaultValue={state.values?.email}
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
