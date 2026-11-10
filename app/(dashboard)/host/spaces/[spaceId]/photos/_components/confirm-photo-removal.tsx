'use client'

// STORY-11, TSK-11.2: In-place server confirmation panel for photo deletion (D-031).
// Triggered via ?remove=<fileName>#confirm, requiring no client dialogs (matches STORY-07).

import Link from 'next/link'
import { useActionState, useEffect, useRef, type FormEvent } from 'react'
import { AlertCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { deletePhoto, type PhotoActionState } from '../actions'

interface ConfirmPhotoRemovalProps {
  spaceId: string
  spaceName: string
  fileName: string
  photoUrl: string
  /** The photo's place in the grid, counting from 1, so the Host can tell which one. */
  position: number
  total: number
}

export function ConfirmPhotoRemoval({
  spaceId,
  spaceName,
  fileName,
  photoUrl,
  position,
  total,
}: ConfirmPhotoRemovalProps) {
  const [state, formAction, pending] = useActionState<PhotoActionState, FormData>(
    deletePhoto,
    {},
  )
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The page opens at #confirm; focus goes to the panel's heading, so keyboard and
  // screen reader users land on the question (matches STORY-07's ConfirmRemoval).
  useEffect(() => {
    headingRef.current?.focus()
  }, [fileName])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // A second press while the first removal runs does nothing.
    if (pending) event.preventDefault()
  }

  return (
    <section id="confirm" aria-labelledby="confirm-heading" className="scroll-mt-6">
      <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <h2
              id="confirm-heading"
              ref={headingRef}
              tabIndex={-1}
              className="font-heading text-lg leading-snug font-semibold"
            >
              Remove this photo?
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            This photo will be permanently removed from your Space. This action cannot be
            undone.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pending && state.formError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative h-24 w-32 overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={`${spaceName}, ${position} of ${total}`}
                className="h-full w-full object-cover"
              />
            </div>
            <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
              Photo {position} of {total}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <form
            action={formAction}
            onSubmit={onSubmit}
            className="flex min-w-0 flex-wrap gap-3"
          >
            <input type="hidden" name="spaceId" value={spaceId} />
            <input type="hidden" name="fileName" value={fileName} />
            <Link
              href={`/host/spaces/${spaceId}/photos`}
              className={buttonVariants({
                variant: 'outline',
                className: 'h-12 min-w-12 px-5 text-sm font-medium',
              })}
            >
              Cancel
            </Link>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending}
              focusableWhenDisabled
              // Wraps at 200% text instead of being cut off at the card's edge.
              className="h-auto min-h-12 max-w-full min-w-12 shrink px-5 py-2 text-sm font-medium whitespace-normal"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Removing photo...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Confirm removal
                </>
              )}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </section>
  )
}
