'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { verifySpaceSchema, type VerifySpaceInput } from '@/lib/validation/verification'

export type SetSpaceStatusResult =
  | { success: true; spaceId: string; status: 'verified' | 'rejected' }
  | { success: false; spaceId: string; error: string }

/**
 * Server Action for Administrator Space verification (STORY-15 design §2 & §3).
 * Validates input against verifySpaceSchema, enforces Administrator session,
 * and calls the database function public.set_space_status with optimistic concurrency.
 */
export async function setSpaceStatusAction(
  input: VerifySpaceInput,
): Promise<SetSpaceStatusResult> {
  const parsed = verifySpaceSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid verification request.'
    return { success: false, spaceId: input?.spaceId || '', error: message }
  }

  const { spaceId, status, updatedAt } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnUrl=%2Fadmin')

  // Execute set_space_status database function (D-053).
  // Security definer function enforces (select private.has_role('admin')).
  const { error } = await supabase.rpc('set_space_status', {
    p_space_id: spaceId,
    p_status: status,
    p_updated_at: updatedAt,
  })

  if (error) {
    const errorText = `${error.message ?? ''} ${error.hint ?? ''} ${error.details ?? ''}`

    if (errorText.includes('stale_version')) {
      return {
        success: false,
        spaceId,
        error:
          'Space details were updated by the host while you were reviewing. Please refresh to inspect the latest information.',
      }
    }

    if (errorText.includes('not_pending')) {
      return {
        success: false,
        spaceId,
        error: 'This space is no longer pending verification.',
      }
    }

    if (error.code === '42501' || errorText.includes('permission denied')) {
      return {
        success: false,
        spaceId,
        error: 'You are not authorized to verify spaces.',
      }
    }

    return {
      success: false,
      spaceId,
      error: 'We could not update the space status. Please try again.',
    }
  }

  revalidatePath('/admin')

  return {
    success: true,
    spaceId,
    status,
  }
}
