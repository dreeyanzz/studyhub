'use client'

// STORY-11, TSK-11.2: Client component for Host photo upload (D-010, D-063).
// Uploads photos directly from browser to Supabase Storage using signed upload URLs,
// bypassing Vercel and Next.js request body caps.

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, UploadCloud } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_FILE_SIZE,
} from '@/lib/validation/space-photos'
import { createPhotoUploadUrls, revalidatePhotos } from '../actions'

interface PhotoUploadFormProps {
  spaceId: string
}

export function PhotoUploadForm({ spaceId }: PhotoUploadFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  async function handleFiles(selectedFiles: FileList | File[]) {
    setErrorMessage(null)
    setSuccessMessage(null)

    const filesArray = Array.from(selectedFiles)
    if (filesArray.length === 0) return

    if (filesArray.length > 10) {
      setErrorMessage('You can upload at most 10 photos at a time.')
      return
    }

    // Client-side pre-validation for immediate UX feedback
    for (const file of filesArray) {
      if (file.size <= 0) {
        setErrorMessage(`Photo "${file.name}" is empty.`)
        return
      }
      if (file.size > MAX_PHOTO_FILE_SIZE) {
        setErrorMessage(
          `Photo "${file.name}" exceeds the 5 MB limit. Please select a smaller photo.`,
        )
        return
      }
      if (!(ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
        setErrorMessage(
          `Photo "${file.name}" has an unsupported format. Supported formats: JPEG, PNG, WebP.`,
        )
        return
      }
    }

    startTransition(async () => {
      setUploadProgress({ current: 0, total: filesArray.length })

      // Step 1: Request signed upload URLs from Server Action
      const metadataPayload = {
        spaceId,
        files: filesArray.map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })),
      }

      const res = await createPhotoUploadUrls(metadataPayload)

      if (!res.success || !res.data) {
        setErrorMessage(
          res.formError ??
            'Could not prepare photo upload. Please check your connection and try again.',
        )
        setUploadProgress(null)
        return
      }

      const { uploads } = res.data
      const supabase = createClient()
      const failedFiles: { name: string; reason: string }[] = []
      let uploadedCount = 0

      // Step 2: Upload each file directly from browser to Supabase Storage
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i]
        const uploadInfo = uploads[i]
        if (!file || !uploadInfo) continue

        try {
          const { error: uploadError } = await supabase.storage
            .from('space-photos')
            .uploadToSignedUrl(uploadInfo.path, uploadInfo.token, file)

          if (uploadError) {
            failedFiles.push({
              name: file.name,
              reason: uploadError.message,
            })
          } else {
            uploadedCount++
          }
        } catch (err) {
          failedFiles.push({
            name: file.name,
            reason: err instanceof Error ? err.message : 'Network error',
          })
        }

        setUploadProgress({ current: i + 1, total: filesArray.length })
      }

      // Step 3: Revalidate server cache if any files succeeded
      if (uploadedCount > 0) {
        await revalidatePhotos(spaceId)
        router.refresh()
      }

      setUploadProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      if (failedFiles.length > 0) {
        const failedSummary = failedFiles
          .map((f) => `"${f.name}" (${f.reason})`)
          .join(', ')

        if (uploadedCount > 0) {
          setErrorMessage(
            `Failed to upload ${failedSummary}. ${uploadedCount} other photo(s) uploaded successfully.`,
          )
        } else {
          setErrorMessage(`Failed to upload: ${failedSummary}. Please try again.`)
        }
      } else {
        setSuccessMessage(
          `Successfully uploaded ${uploadedCount} photo${uploadedCount > 1 ? 's' : ''}.`,
        )
      }
    })
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className="space-y-4">
      <noscript>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>JavaScript required</AlertTitle>
          <AlertDescription>
            Uploading photos requires JavaScript enabled to transfer files directly and
            securely to storage.
          </AlertDescription>
        </Alert>
      </noscript>

      {errorMessage && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Upload error</AlertTitle>
          <AlertDescription className="wrap-anywhere">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert
          variant="default"
          className="border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 bg-card hover:border-muted-foreground/50'
        }`}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Upload Space Photos</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Drag and drop images here, or browse files from your device. Up to 5 MB per
          photo (JPEG, PNG, WebP). Maximum 10 photos per upload.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          id="photo-file-input"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={isPending}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
          }}
        />

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            className="h-12 min-w-12 px-5 text-sm font-medium"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                {uploadProgress
                  ? `Uploading (${uploadProgress.current}/${uploadProgress.total})...`
                  : 'Preparing upload...'}
              </>
            ) : (
              <>
                <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                Browse photos
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
