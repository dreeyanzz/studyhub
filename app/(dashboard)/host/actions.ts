'use server'

// Server Actions for the Host portal: create, update and delete a Space (STORY-05
// design §2.5 and §2.6, D-010). An action can be called directly, so each one checks
// the session and the input itself. proxy.ts only routes, and RLS stays the security
// boundary (D-007).
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import {
  spaceIdSchema,
  spaceSchema,
  type SpaceField,
  type SpaceInput,
} from '@/lib/validation/space'

export type SpaceFormValues = Partial<Record<SpaceField, string>>

export type SpaceFormState = {
  fieldErrors?: Partial<Record<SpaceField, string[]>>
  formError?: string
  // What the Host typed, so a failed save keeps it. Never an id, a status or a
  // Supabase error.
  values?: SpaceFormValues
}

export type DeleteSpaceState = {
  formError?: string
}

const spaceFields: SpaceField[] = [
  'name',
  'description',
  'address',
  'opensAt',
  'closesAt',
]

function formValues(formData: FormData): SpaceFormValues {
  return Object.fromEntries(
    spaceFields.map((field) => [field, String(formData.get(field) ?? '')]),
  )
}

// Exactly the five Host-editable columns. id, host_id, status and the timestamps are
// never sent: the database fills them in, and its column grants refuse them anyway.
function spaceColumns(space: SpaceInput) {
  return {
    name: space.name,
    description: space.description || null,
    address: space.address,
    opens_at: space.opensAt,
    closes_at: space.closesAt,
  }
}

async function signedInClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?returnUrl=%2Fhost')
  return { supabase, user }
}

export async function createSpace(
  _state: SpaceFormState,
  formData: FormData,
): Promise<SpaceFormState> {
  const { supabase } = await signedInClient()
  const values = formValues(formData)
  const parsed = spaceSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  // The insert policy also requires the caller to be a Host (STORY-01).
  const { error } = await supabase.from('spaces').insert(spaceColumns(parsed.data))
  if (error) {
    return { formError: 'We could not create this Space. Please try again.', values }
  }

  revalidatePath('/host')
  redirect('/host?notice=created')
}

export async function updateSpace(
  _state: SpaceFormState,
  formData: FormData,
): Promise<SpaceFormState> {
  const { supabase, user } = await signedInClient()
  const values = formValues(formData)
  const spaceId = spaceIdSchema.safeParse(formData.get('spaceId'))
  if (!spaceId.success) {
    // spaceIdSchema's one generic message, "We could not find that Space." (§2.4)
    return { formError: z.flattenError(spaceId.error).formErrors.join(' '), values }
  }
  const parsed = spaceSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  // Scoped to the caller's own Space here as well as by RLS. Asking for the id back
  // tells one updated row from none, and "none" gets the same message whether the
  // Space is gone or belongs to another Host (STORY-05 design §1.3).
  const { data: updated, error } = await supabase
    .from('spaces')
    .update(spaceColumns(parsed.data))
    .eq('id', spaceId.data)
    .eq('host_id', user.id)
    .select('id')
    .maybeSingle()
  if (error || !updated) {
    return {
      formError:
        'We could not save this Space. It may no longer exist or you may not have access.',
      values,
    }
  }

  revalidatePath('/host')
  redirect('/host?notice=updated')
}

export async function deleteSpace(
  _state: DeleteSpaceState,
  formData: FormData,
): Promise<DeleteSpaceState> {
  const { supabase, user } = await signedInClient()
  const spaceId = spaceIdSchema.safeParse(formData.get('spaceId'))
  if (!spaceId.success) {
    return { formError: z.flattenError(spaceId.error).formErrors.join(' ') }
  }

  // Same scoping and zero-row rule as updateSpace (STORY-05 design §1.4).
  const { data: deleted, error } = await supabase
    .from('spaces')
    .delete()
    .eq('id', spaceId.data)
    .eq('host_id', user.id)
    .select('id')
    .maybeSingle()
  if (error || !deleted) {
    return {
      formError:
        'We could not delete this Space. It may no longer exist or you may not have access.',
    }
  }

  revalidatePath('/host')
  redirect('/host?notice=deleted')
}
