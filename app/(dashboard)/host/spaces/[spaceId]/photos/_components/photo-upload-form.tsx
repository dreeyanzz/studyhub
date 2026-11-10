'use client'

// STORY-11, TSK-11.2: Client component for Host photo upload (D-010, D-063).
// Uploads photos directly from browser to Supabase Storage using signed upload URLs,
// bypassing Vercel and Next.js request body caps.

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RotateCcw,
  UploadCloud,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_FILE_SIZE,
} from '@/lib/validation/space-photos'
import {
  createPhotoUploadUrls,
  revalidatePhotos,
  type SignedUploadInfo,
} from '../actions'

interface PhotoUploadFormProps {
  spaceId: string
}

export interface UploadOutcome {
  uploadedCount: number
  failed: { file: File; reason: string }[]
}

type UploadToSignedUrl = (
  path: string,
  token: string,
  file: File,
) => Promise<{ error: { message: string } | null }>

/**
 * Uploads each file to its signed URL, in order. One failure doesn't stop the rest, and
 * every failed file is returned, so the Host can retry just those (design §3 Screen 2).
 */
export async function uploadToSignedUrls(
  files: File[],
  uploads: SignedUploadInfo[],
  upload: UploadToSignedUrl,
  onProgress?: (done: number) => void,
): Promise<UploadOutcome> {
  const failed: UploadOutcome['failed'] = []
  let uploadedCount = 0

  for (const [i, file] of files.entries()) {
    const uploadInfo = uploads[i]
    if (!uploadInfo) {
      failed.push({ file, reason: 'No upload link was prepared' })
    } else {
      try {
        const { error } = await upload(uploadInfo.path, uploadInfo.token, file)
        if (error) failed.push({ file, reason: error.message })
        else uploadedCount++
      } catch (err) {
        failed.push({
          file,
          reason: err instanceof Error ? err.message : 'Network error',
        })
      }
    }
    onProgress?.(i + 1)
  }

  return { uploadedCount, failed }
}

export function PhotoUploadForm({ spaceId }: PhotoUploadFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // The files whose upload failed last time, kept for "Retry failed uploads".
  const [failedFiles, setFailedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  async function handleFiles(selectedFiles: FileList | File[]) {
    setErrorMessage(null)
    setSuccessMessage(null)
    setFailedFiles([])

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

      // Step 2: Upload each file directly from browser to Supabase Storage
      const bucket = createClient().storage.from('space-photos')
      const { uploadedCount, failed } = await uploadToSignedUrls(
        filesArray,
        res.data.uploads,
        (path, token, file) => bucket.uploadToSignedUrl(path, token, file),
        (done) => setUploadProgress({ current: done, total: filesArray.length }),
      )

      // Step 3: Revalidate server cache if any files succeeded
      if (uploadedCount > 0) {
        await revalidatePhotos(spaceId)
        router.refresh()
      }

      setUploadProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      if (failed.length > 0) {
        setFailedFiles(failed.map((f) => f.file))
        const failedSummary = failed
          .map((f) => `"${f.file.name}" (${f.reason})`)
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
          <AlertDescription className="wrap-anywhere">
            <p>{errorMessage}</p>
            {failedFiles.length > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                focusableWhenDisabled
                onClick={() => handleFiles(failedFiles)}
                className="h-auto min-h-12 min-w-12 px-4 py-2 text-sm font-medium whitespace-normal"
              >
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                {failedFiles.length === 1
                  ? 'Retry failed upload'
                  : 'Retry failed uploads'}
              </Button>
            )}
          </AlertDescription>
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
        <h2 className="text-base font-semibold text-foreground">Upload Space Photos</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Drag and drop images here, or browse files from your device. Up to 5 MB per
          photo (JPEG, PNG, WebP). Maximum 10 photos per upload.
        </p>

        {/* "Browse photos" is the control; the input itself stays out of the tab
            order, so keyboard focus never lands on an invisible element. */}
        <input
          ref={fileInputRef}
          type="file"
          id="photo-file-input"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
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
            // Wraps at 200% text instead of running past the drop zone's edge.
            className="h-auto min-h-12 max-w-full min-w-12 shrink px-5 py-2 text-sm font-medium whitespace-normal"
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
