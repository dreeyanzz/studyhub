'use server'

// STORY-11, TSK-11.2: Server Actions for Host photo management (D-010, D-063).
// Provides signed upload URLs so browsers upload directly to Supabase Storage,
// bypassing Vercel request body limits (4.5 MB) and Next.js Server Action body caps.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'
import {
  type ALLOWED_PHOTO_MIME_TYPES,
  deletePhotoSchema,
  uploadPhotosRequestSchema,
} from '@/lib/validation/space-photos'

export type PhotoActionState<T = unknown> = {
  success?: boolean
  data?: T
  fieldErrors?: Record<string, string[]>
  formError?: string
}

export interface SignedUploadInfo {
  fileName: string
  path: string
  signedUrl: string
  token: string
}

// The schema only lets these three types through, so every upload has an extension.
const PHOTO_EXTENSIONS: Record<(typeof ALLOWED_PHOTO_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function verifySpaceOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spaceId: string,
  userId: string,
): Promise<boolean> {
  const { data: space, error } = await supabase
    .from('spaces')
    .select('id')
    .eq('id', spaceId)
    .eq('host_id', userId)
    .maybeSingle()
  return !error && !!space
}

/**
 * Validates session, validates metadata for 1-10 photos (<= 5 MB, JPEG/PNG/WebP),
 * verifies Space ownership, and returns signed upload URLs from Supabase Storage.
 */
export async function createPhotoUploadUrls(
  payload: unknown,
): Promise<PhotoActionState<{ uploads: SignedUploadInfo[] }>> {
  const parsed = uploadPhotosRequestSchema.safeParse(payload)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const firstErrorMessage = parsed.error.issues[0]?.message ?? 'Invalid photo metadata'
    return {
      success: false,
      fieldErrors,
      formError: firstErrorMessage,
    }
  }

  const { spaceId, files } = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      formError: 'You must be signed in to manage photos.',
    }
  }

  const isOwner = await verifySpaceOwner(supabase, spaceId, user.id)
  if (!isOwner) {
    return {
      success: false,
      formError: 'You do not have permission to manage photos for this Space.',
    }
  }

  const uploads: SignedUploadInfo[] = []

  for (const file of files) {
    const ext = PHOTO_EXTENSIONS[file.type as keyof typeof PHOTO_EXTENSIONS]
    const fileId = crypto.randomUUID()
    const fileName = `${fileId}.${ext}`
    const destinationPath = `${spaceId}/${fileName}`

    const { data, error } = await supabase.storage
      .from('space-photos')
      .createSignedUploadUrl(destinationPath)

    if (error || !data) {
      return {
        success: false,
        formError: `Failed to create signed upload URL: ${error?.message ?? 'Storage error'}`,
      }
    }

    uploads.push({
      fileName,
      path: destinationPath,
      signedUrl: data.signedUrl,
      token: data.token,
    })
  }

  return {
    success: true,
    data: { uploads },
  }
}

/**
 * Revalidates photo management and profile routes after client-side uploads finish.
 */
export async function revalidatePhotos(spaceIdInput: unknown): Promise<PhotoActionState> {
  const parsed = spaceIdSchema.safeParse(spaceIdInput)
  if (!parsed.success) {
    return {
      success: false,
      formError: 'Invalid Space ID.',
    }
  }

  const spaceId = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      formError: 'You must be signed in to manage photos.',
    }
  }

  const isOwner = await verifySpaceOwner(supabase, spaceId, user.id)
  if (!isOwner) {
    return {
      success: false,
      formError: 'You do not have permission to manage photos for this Space.',
    }
  }

  revalidatePath(`/host/spaces/${spaceId}/photos`)
  revalidatePath(`/spaces/${spaceId}`)

  return { success: true }
}

/**
 * Deletes a photo from the space-photos storage bucket: the confirmation step's form
 * action (useActionState). On success it returns the Host to the photos page.
 */
export async function deletePhoto(
  _prevState: PhotoActionState,
  formData: FormData,
): Promise<PhotoActionState> {
  const parsed = deletePhotoSchema.safeParse({
    spaceId: formData.get('spaceId'),
    fileName: formData.get('fileName'),
  })
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const firstErrorMessage =
      parsed.error.issues[0]?.message ?? 'Invalid photo deletion request'
    return {
      success: false,
      fieldErrors,
      formError: firstErrorMessage,
    }
  }

  const { spaceId, fileName } = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnUrl=%2Fhost')

  const isOwner = await verifySpaceOwner(supabase, spaceId, user.id)
  if (!isOwner) {
    return {
      success: false,
      formError: 'You do not have permission to manage photos for this Space.',
    }
  }

  const objectPath = `${spaceId}/${fileName}`
  const { error } = await supabase.storage.from('space-photos').remove([objectPath])

  if (error) {
    return {
      success: false,
      formError: `Failed to delete photo: ${error.message}`,
    }
  }

  revalidatePath(`/host/spaces/${spaceId}/photos`)
  revalidatePath(`/spaces/${spaceId}`)
  redirect(`/host/spaces/${spaceId}/photos`)
}
