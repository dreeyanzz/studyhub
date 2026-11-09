'use client'

// STORY-11, TSK-11.2: In-place server confirmation panel for photo deletion (D-031).
// Triggered via ?remove=<fileName>#confirm, requiring no client dialogs (matches STORY-07).

import Link from 'next/link'
import { useActionState } from 'react'
import { AlertCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { deletePhoto, type PhotoActionState } from '../actions'

interface ConfirmPhotoRemovalProps {
  spaceId: string
  fileName: string
  photoUrl: string
}

export function ConfirmPhotoRemoval({
  spaceId,
  fileName,
  photoUrl,
}: ConfirmPhotoRemovalProps) {
  const [state, formAction, pending] = useActionState<PhotoActionState, FormData>(
    deletePhoto,
    {},
  )

  return (
    <div id="confirm" tabIndex={-1} className="scroll-mt-6 focus:outline-none">
      <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <CardTitle className="text-lg font-semibold">Remove this photo?</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            This photo will be permanently removed from your Space. This action cannot be
            undone.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {state?.formError && (
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
                alt={`Preview of ${fileName}`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium wrap-anywhere text-foreground">
                {fileName}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-3">
          <form action={formAction}>
            <input type="hidden" name="spaceId" value={spaceId} />
            <input type="hidden" name="fileName" value={fileName} />
            <Button
              type="submit"
              variant="destructive"
              disabled={pending}
              className="h-12 min-w-12 px-5 text-sm font-medium"
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
          <Link
            href={`/host/spaces/${spaceId}/photos`}
            className={buttonVariants({
              variant: 'outline',
              className: 'h-12 min-w-12 px-5 text-sm font-medium',
            })}
          >
            Cancel
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
