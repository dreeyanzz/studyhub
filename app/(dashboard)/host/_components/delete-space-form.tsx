'use client'

import Link from 'next/link'
import { useActionState, type FormEvent } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'

import { deleteSpace } from '../actions'

/**
 * The confirmation on a Space's delete page (STORY-05 design §3.4). Only pressing
 * Delete Space posts deleteSpace. Cancel is a plain link back to /host, and it comes
 * first in the tab order.
 */
export function DeleteSpaceForm({ spaceId }: { spaceId: string }) {
  const [state, formAction, pending] = useActionState(deleteSpace, {})

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // A second press while the first delete runs does nothing.
    if (pending) event.preventDefault()
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Hidden while a new attempt runs, so a repeated message is announced again. */}
      {!pending && state.formError && (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="spaceId" value={spaceId} />
      <div className="flex flex-wrap gap-3">
        <Link href="/host" className={buttonVariants({ variant: 'outline' })}>
          Cancel
        </Link>
        <Button
          type="submit"
          variant="destructive"
          disabled={pending}
          focusableWhenDisabled
        >
          {pending ? 'Deleting Space…' : 'Delete Space'}
        </Button>
      </div>
    </form>
  )
}
