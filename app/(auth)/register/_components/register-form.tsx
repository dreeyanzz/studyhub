'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { registerSchema } from '@/lib/validation/auth'

import { register } from '../../actions'
import { FormField } from '../../_components/form-field'
import { useAuthForm } from '../../_components/use-auth-form'

// The only roles anyone can sign up as; an Administrator is never self-registered (D-013).
const roles = [
  { value: 'seeker', label: 'Seeker', text: 'Find a Space and hold a seat.' },
  {
    value: 'host',
    label: 'Host',
    text: 'List your Space and keep its seats up to date.',
  },
] as const

export function RegisterForm() {
  const { formProps, state, pending, errors, showServerMessage } = useAuthForm(
    registerSchema,
    register,
  )
  const roleError = errors.role?.[0]

  return (
    <form {...formProps} className="flex flex-col gap-5">
      {showServerMessage && state.formError && (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      {showServerMessage && state.notice && (
        <Alert role="status">
          <AlertDescription>{state.notice}</AlertDescription>
        </Alert>
      )}

      {/* ARIA puts the invalid state on the group, not on each radio. Names are
          explicit: the legend names the group, and each title names its radio. */}
      <fieldset
        role="radiogroup"
        aria-labelledby="role-legend"
        aria-required
        aria-invalid={roleError ? true : undefined}
        aria-describedby={roleError ? 'role-error' : undefined}
        className="flex flex-col gap-2"
      >
        <legend id="role-legend" className="mb-2 text-sm font-medium">
          I want to join as
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((role) => (
            <label
              key={role.value}
              htmlFor={`role-${role.value}`}
              className="grid min-h-12 cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-lg border border-input p-3 has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background"
            >
              <input
                id={`role-${role.value}`}
                type="radio"
                name="role"
                value={role.value}
                defaultChecked={state.values?.role === role.value}
                aria-labelledby={`role-${role.value}-label`}
                aria-describedby={`role-${role.value}-text`}
                className="row-span-2 mt-0.5 size-5 accent-primary focus-visible:outline-none"
              />
              <span id={`role-${role.value}-label`} className="font-medium">
                {role.label}
              </span>
              <span
                id={`role-${role.value}-text`}
                className="text-sm text-muted-foreground"
              >
                {role.text}
              </span>
            </label>
          ))}
        </div>
        {roleError && (
          <p id="role-error" className="text-sm text-destructive">
            {roleError}
          </p>
        )}
      </fieldset>

      <FormField
        id="fullName"
        label="Full name"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={errors.fullName}
      />
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
        autoComplete="new-password"
        required
        hint="At least 8 characters, with a number and a symbol."
        errors={errors.password}
      />
      <FormField
        id="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        errors={errors.confirmPassword}
      />
      <Button type="submit" disabled={pending} focusableWhenDisabled>
        {pending ? 'Creating your account…' : 'Create account'}
      </Button>
    </form>
  )
}
