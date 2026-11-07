'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, type FormEvent } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'

import { deleteUnit, deleteZone, type SeatMapActionState } from '../actions'

/** What the confirmation step removes, as the page found it in this Space. */
export type RemovalTarget =
  | { kind: 'unit'; id: string; label: string; zoneId: string; zoneName: string }
  | { kind: 'zone'; id: string; name: string; unitCount: number }

type ConfirmRemovalProps = {
  spaceId: string
  target: RemovalTarget
  /** The page without ?remove= or ?delete-zone=, for Cancel. */
  cancelHref: string
  /**
   * Called as the form is submitted. A successful removal also removes this panel in
   * the same render (the target is gone from the refreshed page), so the caller, which
   * stays on the page, checks the result and announces it.
   */
  onSubmitted?: (target: RemovalTarget) => void
}

/**
 * The confirmation step for Remove (a unit) and Delete (a zone), STORY-07 design §3.
 * The page opens it from ?remove=<unit id> or ?delete-zone=<zone id>, so nothing is
 * removed until this form is submitted, and Cancel, a plain link, comes first. The form
 * posts the Server Action itself, so TSK-07.7's list view can use it before JavaScript
 * loads.
 */
export function ConfirmRemoval({
  spaceId,
  target,
  cancelHref,
  onSubmitted,
}: ConfirmRemovalProps) {
  const action = target.kind === 'unit' ? deleteUnit : deleteZone
  const [state, formAction, pending] = useActionState<SeatMapActionState, FormData>(
    action,
    {},
  )
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The page opens at #confirm; focus goes to the panel's heading (design §3).
  useEffect(() => {
    headingRef.current?.focus()
  }, [target.id])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // A second press while the first removal runs does nothing.
    if (pending) {
      event.preventDefault()
      return
    }
    onSubmitted?.(target)
  }

  const question =
    target.kind === 'unit'
      ? `Remove ${target.label}?`
      : target.unitCount === 0
        ? `Delete ${target.name}?`
        : `Delete ${target.name} and its ${target.unitCount} ${
            target.unitCount === 1 ? 'unit' : 'units'
          }?`

  return (
    <section
      id="confirm"
      aria-labelledby="confirm-heading"
      className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
    >
      <h2
        id="confirm-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold wrap-anywhere text-foreground"
      >
        {question}
      </h2>
      <p className="text-sm wrap-anywhere text-muted-foreground">
        {target.kind === 'unit'
          ? `This removes ${target.label} from ${target.zoneName}. It can't be undone.`
          : "This removes the zone and every unit in it. It can't be undone."}
      </p>
      {!pending && state.formError && (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      <form action={formAction} onSubmit={onSubmit} className="flex flex-wrap gap-3">
        <input type="hidden" name="spaceId" value={spaceId} />
        <input
          type="hidden"
          name={target.kind === 'unit' ? 'unitId' : 'zoneId'}
          value={target.id}
        />
        <Link href={cancelHref} className={buttonVariants({ variant: 'outline' })}>
          Cancel
        </Link>
        <Button
          type="submit"
          variant="destructive"
          disabled={pending}
          focusableWhenDisabled
        >
          {pending
            ? 'Removing…'
            : target.kind === 'unit'
              ? `Remove ${target.label}`
              : 'Delete zone'}
        </Button>
      </form>
    </section>
  )
}
