'use client'

import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { chooseRoleSchema, type RegistrationRole } from '@/lib/validation/auth'

import { completeOAuthRole } from '../../actions'
import { FormField } from '../../_components/form-field'
import { useAuthForm } from '../../_components/use-auth-form'

// Only Seeker and Host can be chosen; Administrator is never self-registered (D-013, D-095).
const roles = [
  { value: 'seeker', label: 'Seeker', text: 'Find a Space and hold a seat.' },
  {
    value: 'host',
    label: 'Host',
    text: 'List your Space and keep its seats up to date.',
  },
] as const

export function ChooseRoleForm({
  defaultFullName = '',
  defaultRole,
  returnUrl = '',
}: {
  defaultFullName?: string
  defaultRole?: RegistrationRole
  returnUrl?: string
}) {
  const { formProps, state, pending, errors, showServerMessage } = useAuthForm(
    chooseRoleSchema,
    completeOAuthRole,
  )
  const roleError = errors.role?.[0]
  const [fullName, setFullName] = useState(state.values?.fullName ?? defaultFullName)

  return (
    <form {...formProps} className="flex flex-col gap-5">
      {showServerMessage && state.formError && (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <input type="hidden" name="returnUrl" value={returnUrl} />

      <FormField
        id="fullName"
        label="Full name"
        autoComplete="name"
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        errors={errors.fullName}
      />

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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {roles.map((role) => (
            <label
              key={role.value}
              htmlFor={`role-${role.value}`}
              className="grid min-h-12 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-lg border border-input p-3 has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background"
            >
              <input
                id={`role-${role.value}`}
                type="radio"
                name="role"
                value={role.value}
                defaultChecked={(state.values?.role ?? defaultRole) === role.value}
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

      <Button
        type="submit"
        disabled={pending}
        focusableWhenDisabled
        className="h-auto min-h-12 w-full py-3 whitespace-normal"
      >
        {pending ? 'Saving your account…' : 'Continue to Worq'}
      </Button>
    </form>
  )
}
