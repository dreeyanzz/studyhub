'use server'

// Server Action for the Host's tagging form: step H8 of the Host setup journey
// (STORY-08 design §0 and §3, D-006, D-010). An action can be called directly, so it
// checks the session, the input and ownership itself. RLS stays the security boundary:
// the tag tables' policies let only the Space's own Host insert or delete (D-007).
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { spaceTagsSchema } from '@/lib/validation/tags'

export type SpaceTagsField = 'curatedTagIds' | 'customTagNames'

export type SpaceTagsState = {
  success?: boolean
  formError?: string
  fieldErrors?: Partial<Record<SpaceTagsField, string[]>>
}

// One message whether the Space is gone or belongs to another Host, so the action
// never confirms that someone else's Space exists (as STORY-05 design §1.3).
const notYours =
  'We could not save these tags. The Space may no longer exist or you may not have access.'
const saveFailed = 'We could not save these tags. Please try again.'

/**
 * Replaces a Space's curated and custom tags with the submitted set (STORY-08 design
 * §0). Only the differences are written: tags no longer chosen are deleted, then new
 * ones are inserted. Deleting first lets a Host change a custom tag's capitals
 * ("wifi" to "WiFi") without tripping the case-insensitive unique index.
 *
 * The Space's own row is never touched, so its Verification status stays as it was
 * (Host setup journey W4, D-027).
 */
export async function saveSpaceTagsAction(
  _state: SpaceTagsState,
  formData: FormData,
): Promise<SpaceTagsState> {
  const parsed = spaceTagsSchema.safeParse({
    spaceId: formData.get('spaceId'),
    curatedTagIds: formData.getAll('curatedTagIds').map(String),
    customTagNames: formData.getAll('customTagNames').map(String),
  })
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error)
    // A bad spaceId is the page's own hidden field, so it gets the generic message.
    if (fieldErrors.spaceId) return { formError: notYours }
    return {
      formError: 'Check the tags below and try again.',
      fieldErrors: {
        curatedTagIds: fieldErrors.curatedTagIds,
        customTagNames: fieldErrors.customTagNames,
      },
    }
  }
  const { spaceId, curatedTagIds, customTagNames } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?returnUrl=%2Fhost')

  // Owner-scoped here as well as by RLS, so an Administrator (D-032) cannot tag
  // another Host's Space either.
  const { data: space, error: spaceError } = await supabase
    .from('spaces')
    .select('id')
    .eq('id', spaceId)
    .eq('host_id', user.id)
    .maybeSingle()
  if (spaceError || !space) return { formError: notYours }

  // Only ids in the curated catalog are accepted. The foreign key would refuse the
  // rest anyway, but checking first means a bad id changes nothing at all.
  const { data: catalog, error: catalogError } = await supabase
    .from('curated_tags')
    .select('id')
  if (catalogError || !catalog) return { formError: saveFailed }
  const known = new Set(catalog.map((tag) => tag.id))
  const wanted = [...new Set(curatedTagIds)]
  if (wanted.some((id) => !known.has(id))) {
    return {
      formError: 'Check the tags below and try again.',
      fieldErrors: { curatedTagIds: ['Choose only the amenities listed.'] },
    }
  }

  const [curatedResult, customResult] = await Promise.all([
    supabase.from('space_curated_tags').select('tag_id').eq('space_id', spaceId),
    supabase.from('space_custom_tags').select('id, name').eq('space_id', spaceId),
  ])
  if (curatedResult.error || customResult.error) return { formError: saveFailed }

  // Curated tags: compare by id.
  const currentCurated = new Set((curatedResult.data ?? []).map((row) => row.tag_id))
  const wantedCurated = new Set(wanted)
  const curatedToRemove = [...currentCurated].filter((id) => !wantedCurated.has(id))
  const curatedToAdd = wanted.filter((id) => !currentCurated.has(id))

  // Custom tags: compare by the exact trimmed name, so a change of capitals is a
  // remove and an add.
  const currentCustom = customResult.data ?? []
  const wantedCustom = new Set(customTagNames)
  const customToRemove = currentCustom
    .filter((row) => !wantedCustom.has(row.name))
    .map((row) => row.id)
  const currentNames = new Set(currentCustom.map((row) => row.name))
  const customToAdd = customTagNames.filter((name) => !currentNames.has(name))

  if (curatedToRemove.length > 0) {
    const { error } = await supabase
      .from('space_curated_tags')
      .delete()
      .eq('space_id', spaceId)
      .in('tag_id', curatedToRemove)
    if (error) return { formError: saveFailed }
  }
  if (customToRemove.length > 0) {
    const { error } = await supabase
      .from('space_custom_tags')
      .delete()
      .eq('space_id', spaceId)
      .in('id', customToRemove)
    if (error) return { formError: saveFailed }
  }
  if (curatedToAdd.length > 0) {
    const { error } = await supabase
      .from('space_curated_tags')
      .insert(curatedToAdd.map((tagId) => ({ space_id: spaceId, tag_id: tagId })))
    if (error) return { formError: saveFailed }
  }
  if (customToAdd.length > 0) {
    const { error } = await supabase
      .from('space_custom_tags')
      .insert(customToAdd.map((name) => ({ space_id: spaceId, name })))
    if (error) {
      // 23505: the case-insensitive unique index, if two saves raced.
      if (error.code === '23505') {
        return {
          formError: 'Check the tags below and try again.',
          fieldErrors: { customTagNames: ['Each custom tag must be different.'] },
        }
      }
      return { formError: saveFailed }
    }
  }

  revalidatePath(`/host/spaces/${spaceId}/tags`)
  // Seekers see the new tags on discovery and the profile (STORY-08, STORY-11).
  revalidatePath('/spaces')
  revalidatePath(`/spaces/${spaceId}`)
  return { success: true }
}
