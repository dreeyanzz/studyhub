'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
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

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: full_name.trim(),
      phone_number: dbPhoneNumber,
    })
    .eq('id', user.id)

  if (error) {
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
