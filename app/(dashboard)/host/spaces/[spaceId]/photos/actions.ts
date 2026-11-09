'use server'

// STORY-11, TSK-11.2: Server Actions for Host photo management (D-010, D-063).
// Provides signed upload URLs so browsers upload directly to Supabase Storage,
// bypassing Vercel request body limits (4.5 MB) and Next.js Server Action body caps.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'
import {
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

function getExtension(mimeType: string, fileName?: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext === 'jpeg' || ext === 'jpg') return 'jpg'
    if (ext === 'png') return 'png'
    if (ext === 'webp') return 'webp'
  }
  return 'jpg'
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
    const ext = getExtension(file.type, file.name)
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
 * Deletes a photo from the space-photos storage bucket.
 * Supports both FormData form action submission and programmatic calls.
 */
export async function deletePhoto(
  stateOrPayloadOrFormData: unknown,
  maybeFormData?: FormData,
): Promise<PhotoActionState> {
  let isFormSubmit = false
  let rawPayload: unknown = stateOrPayloadOrFormData

  if (typeof FormData !== 'undefined') {
    if (stateOrPayloadOrFormData instanceof FormData) {
      isFormSubmit = true
      rawPayload = Object.fromEntries(stateOrPayloadOrFormData.entries())
    } else if (maybeFormData instanceof FormData) {
      isFormSubmit = true
      rawPayload = Object.fromEntries(maybeFormData.entries())
    }
  }

  const parsed = deletePhotoSchema.safeParse(rawPayload)
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

  if (!user) {
    redirect('/login?returnUrl=%2Fhost')
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

  if (isFormSubmit) {
    redirect(`/host/spaces/${spaceId}/photos`)
  }

  return { success: true }
}
