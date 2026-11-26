'use client'

import { useActionState, type FormEvent } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { resubmitSpaceAction } from '../actions'

/**
 * "Resubmit" on a Rejected or Taken down Space's card (V8, STORY-20 design §3,
 * D-084). A form posting to resubmitSpaceAction, so it works without JavaScript too.
 * On success the action redirects to /host?notice=resubmitted, whose notice
 * announces it.
 */
export function ResubmitSpaceButton({
  spaceId,
  spaceName,
}: {
  spaceId: string
  spaceName: string
}) {
  const [state, formAction, pending] = useActionState(resubmitSpaceAction, {})

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // A second press while the first resubmission runs does nothing.
    if (pending) event.preventDefault()
  }

  return (
    // Its own row, so the alert below the button never squeezes the card's links.
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="flex basis-full flex-col gap-2"
    >
      <input type="hidden" name="spaceId" value={spaceId} />
      {/* Hidden while a new attempt runs, so a repeated message is announced again. */}
      {!pending && state.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button
          type="submit"
          disabled={pending}
          focusableWhenDisabled
          aria-busy={pending || undefined}
        >
          {pending ? 'Resubmitting...' : 'Resubmit'}
          {/* The hidden name tells one card's Resubmit from another's (design §3). */}
          <span className="sr-only"> {spaceName}</span>
        </Button>
      </div>
    </form>
  )
}
