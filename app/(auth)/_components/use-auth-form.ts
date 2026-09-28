import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'

import type { AuthFormState } from '../actions'

type AuthAction = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>

// Runs the form's Zod schema in the browser before the Server Action, which runs
// it again (STORY-03 design §2), and moves focus to the first field in error.
export function useAuthForm(schema: z.ZodType, action: AuthAction) {
  const [state, formAction, pending] = useActionState(action, {})
  const [clientErrors, setClientErrors] = useState<AuthFormState['fieldErrors']>()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    // A radio group is marked as a whole, so focus its first radio.
    const target = invalid?.matches('input') ? invalid : invalid?.querySelector('input')
    target?.focus()
  }, [state, clientErrors])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault()
      return
    }
    const result = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (result.success) {
      setClientErrors(undefined)
    } else {
      event.preventDefault()
      setClientErrors(z.flattenError(result.error).fieldErrors)
    }
  }

  return {
    formProps: { ref: formRef, action: formAction, onSubmit, noValidate: true },
    state,
    pending,
    errors: clientErrors ?? state.fieldErrors ?? {},
    // Hidden while a new attempt runs, so a repeated message is inserted again and
    // its role="alert" announces it again.
    showServerMessage: !pending && !clientErrors,
  }
}
