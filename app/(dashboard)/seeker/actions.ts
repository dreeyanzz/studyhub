'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { checkOutSchema } from '@/lib/validation/check-in'
import { profileUpdateSchema } from '@/lib/validation/profile'

export type ProfileFormState = {
  fieldErrors?: Partial<Record<'full_name' | 'phone_number', string[]>>
  formError?: string
  successMessage?: string
  values?: {
    full_name?: string
    phone_number?: string
  }
}

/**
 * Server Action to update the signed-in seeker's profile details (STORY-04).
 * Validates inputs with profileUpdateSchema, converts empty phone numbers to null,
 * updates public.profiles, and revalidates /seeker.
 */
export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?returnUrl=%2Fseeker')
  }

  const rawFullName = String(formData.get('full_name') ?? '')
  const rawPhoneNumber = String(formData.get('phone_number') ?? '')
  const values = { full_name: rawFullName, phone_number: rawPhoneNumber }

  const parsed = profileUpdateSchema.safeParse({
    full_name: rawFullName,
    phone_number: rawPhoneNumber,
  })

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors
    return {
      fieldErrors: {
        full_name: fieldErrors.full_name,
        phone_number: fieldErrors.phone_number,
      },
      formError: 'Please correct the errors in the form before saving.',
      values,
    }
  }

  const { full_name, phone_number } = parsed.data
  // Empty phone number is saved as null (TSK-04.4 criterion 2)
  const dbPhoneNumber =
    phone_number && phone_number.trim().length > 0 ? phone_number.trim() : null

  // Asking for the id back tells one saved row from none. An update that matches no
  // row returns no error, so without it the form would say "saved" when nothing was
  // (#142, the same zero-row rule as updateSpace in STORY-05 §2.6).
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      full_name: full_name.trim(),
      phone_number: dbPhoneNumber,
    })
    .eq('id', user.id)
    .select('id')
    .maybeSingle()

  if (error || !updated) {
    return {
      formError: 'We could not save your profile. Please try again.',
      values,
    }
  }

  revalidatePath('/seeker')

  return {
    successMessage: 'Profile changes saved.',
    values: {
      full_name: full_name.trim(),
      phone_number: dbPhoneNumber ?? '',
    },
  }
}

/**
 * Seeker early check-out (STORY-10, TSK-10.3, FR-2.8, R5).
 * Calls `public.check_out` so an occupied unit is released immediately.
 */
export async function checkOutAction(reservationId: string): Promise<void> {
  const parsed = checkOutSchema.safeParse({ reservationId })
  if (!parsed.success) redirect('/seeker')

  const { reservationId: id } = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?returnUrl=%2Fseeker')

  const { error } = await supabase.rpc('check_out', { p_reservation_id: id })
  if (error) {
    const hint = error.code === 'P0001' ? error.hint : undefined
    if (hint === 'hold_ended') {
      revalidatePath('/seeker')
      redirect(`/seeker?reservation=${id}`)
    }
    if (hint === 'not_checked_in') {
      revalidatePath('/seeker')
      redirect('/seeker')
    }
    redirect('/seeker?error=check-out')
  }

  revalidatePath('/seeker')
  redirect(`/seeker?reservation=${id}`)
}
