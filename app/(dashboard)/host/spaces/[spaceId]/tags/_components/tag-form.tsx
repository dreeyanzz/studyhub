'use client'

import Link from 'next/link'
import { useActionState, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { spaceTagsSchema } from '@/lib/validation/tags'

import { saveSpaceTagsAction, type SpaceTagsState } from '../actions'

/** One row of public.curated_tags, as the page reads it (STORY-08 design §2). */
export type CuratedTagOption = {
  id: string
  category: string
  label: string
  description: string | null
}

// The four curated categories, in the order the form shows them, with the heading
// for each (STORY-08 design §3). Hours, price tier and unit type are not tags: they
// come from the Space and its units.
const categories: { id: string; heading: string }[] = [
  { id: 'wifi', heading: 'Wi-Fi' },
  { id: 'power', heading: 'Power outlets' },
  { id: 'noise', heading: 'Noise level' },
  { id: 'ac', heading: 'Air conditioning' },
]

type TagFormProps = {
  spaceId: string
  catalog: CuratedTagOption[]
  initialCuratedTagIds: string[]
  initialCustomTagNames: string[]
}

/**
 * The Host's tagging form (STORY-08 design §3): curated amenity checkboxes by
 * category, and display-only custom tags as removable pills. spaceTagsSchema's
 * custom-tag rule runs here as each tag is added, and the Server Action runs the
 * whole schema again.
 */
export function TagForm({
  spaceId,
  catalog,
  initialCuratedTagIds,
  initialCustomTagNames,
}: TagFormProps) {
  const [dirty, setDirty] = useState(false)
  const [state, formAction, pending] = useActionState<SpaceTagsState, FormData>(
    async (prevState, formData) => {
      const result = await saveSpaceTagsAction(prevState, formData)
      if (result.success) {
        setDirty(false)
      }
      return result
    },
    {},
  )
  const [curated, setCurated] = useState(() => new Set(initialCuratedTagIds))
  const [customNames, setCustomNames] = useState(initialCustomTagNames)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string>()

  function toggleCurated(id: string, checked: boolean) {
    setCurated((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    setDirty(true)
  }

  function addCustomTag() {
    const name = draft.trim()
    if (!name) {
      setDraftError('Type a tag first.')
      return
    }
    // The same rule the server applies: length, characters, at most ten, and no
    // two the same apart from capitals.
    const result = spaceTagsSchema.shape.customTagNames.safeParse([...customNames, name])
    if (!result.success) {
      setDraftError(result.error.issues[0]?.message)
      return
    }
    setCustomNames(result.data)
    setDraft('')
    setDraftError(undefined)
    setDirty(true)
  }

  function removeCustomTag(name: string) {
    setCustomNames((current) => current.filter((existing) => existing !== name))
    setDirty(true)
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter adds the tag instead of submitting the whole form.
    if (event.key === 'Enter') {
      event.preventDefault()
      addCustomTag()
    }
  }

  const fieldErrors = pending ? {} : (state.fieldErrors ?? {})
  const formError = pending ? undefined : state.formError
  const saved = !pending && !dirty && state.success
  const customError = draftError ?? fieldErrors.customTagNames?.[0]
  const customErrorId = 'custom-tags-error'

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="spaceId" value={spaceId} />

      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert role="status">
          <AlertTitle>Tags saved.</AlertTitle>
        </Alert>
      )}

      <section aria-labelledby="curated-tags-heading" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="curated-tags-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Amenities
          </h2>
          <p className="text-sm text-muted-foreground">
            Seekers filter by these, so tick only what every visitor can count on.
          </p>
          {fieldErrors.curatedTagIds?.[0] && (
            <p className="text-sm text-destructive">{fieldErrors.curatedTagIds[0]}</p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((category) => {
            const options = catalog.filter((tag) => tag.category === category.id)
            if (options.length === 0) return null
            return (
              <fieldset
                key={category.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-4"
              >
                <legend className="px-1 text-sm font-medium">{category.heading}</legend>
                {options.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      name="curatedTagIds"
                      value={tag.id}
                      checked={curated.has(tag.id)}
                      onChange={(event) => toggleCurated(tag.id, event.target.checked)}
                      className="mt-0.5 size-5 shrink-0 accent-primary"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{tag.label}</span>
                      {tag.description && (
                        <span className="text-sm text-muted-foreground">
                          {tag.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="custom-tags-heading" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="custom-tags-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Custom display tags
          </h2>
          {/* D-006, FR-1.3: custom tags are shown, never filtered on. */}
          <p className="text-sm text-muted-foreground">
            Custom tags are displayed on your space profile for context, but do not power
            seeker search filters.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="custom-tag-draft">Add a custom tag</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="custom-tag-draft"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                setDraftError(undefined)
              }}
              onKeyDown={onDraftKeyDown}
              maxLength={30}
              placeholder="For example, Pet friendly"
              aria-invalid={customError ? true : undefined}
              aria-describedby={
                ['custom-tag-hint', customError && customErrorId]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              className="max-w-sm min-w-0 flex-1"
            />
            <Button type="button" variant="outline" onClick={addCustomTag}>
              Add
            </Button>
          </div>
          <p id="custom-tag-hint" className="text-sm text-muted-foreground">
            Up to 10 tags, 30 characters each. Press Enter or Add.
          </p>
          {customError && (
            <p id={customErrorId} className="text-sm text-destructive">
              {customError}
            </p>
          )}
        </div>

        {customNames.length > 0 ? (
          <ul aria-label="Custom tags" className="flex flex-wrap gap-2">
            {customNames.map((name) => (
              <li
                key={name}
                className="flex items-center gap-1 rounded-full border border-dashed border-border py-1 pr-1 pl-3 text-sm"
              >
                <span className="wrap-anywhere">{name}</span>
                <input type="hidden" name="customTagNames" value={name} />
                <button
                  type="button"
                  onClick={() => removeCustomTag(name)}
                  aria-label={`Remove tag ${name}`}
                  className="inline-flex size-12 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No custom tags yet.</p>
        )}
      </section>

      <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-border bg-background py-4">
        <Button type="submit" disabled={pending} focusableWhenDisabled>
          {pending ? 'Saving tags…' : 'Save tags'}
        </Button>
        <Link href="/host" className={buttonVariants({ variant: 'outline' })}>
          Discard changes
        </Link>
      </div>
    </form>
  )
}
