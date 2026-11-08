import { describe, expect, it } from 'vitest'
import { spaceTagsSchema } from './tags'

describe('spaceTagsSchema (STORY-08, FR-1.2, D-006)', () => {
  const validSpaceId = '11111111-1111-4111-8111-111111111111'

  it('passes valid curated tags and custom display tags', () => {
    const result = spaceTagsSchema.safeParse({
      spaceId: validSpaceId,
      curatedTagIds: ['wifi_fast', 'outlets_all', 'ac_full'],
      customTagNames: ['Coffee bar', 'Ergonomic chairs', 'Free snacks'],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.spaceId).toBe(validSpaceId)
      expect(result.data.curatedTagIds).toHaveLength(3)
      expect(result.data.customTagNames).toEqual([
        'Coffee bar',
        'Ergonomic chairs',
        'Free snacks',
      ])
    }
  })

  it('fails when spaceId is not a valid UUID', () => {
    const result = spaceTagsSchema.safeParse({
      spaceId: 'not-a-uuid',
      curatedTagIds: [],
      customTagNames: [],
    })

    expect(result.success).toBe(false)
  })

  it('enforces maximum limit of 20 curated tags', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `tag_${i}`)
    const result = spaceTagsSchema.safeParse({
      spaceId: validSpaceId,
      curatedTagIds: tooMany,
      customTagNames: [],
    })

    expect(result.success).toBe(false)
  })

  it('enforces maximum limit of 10 custom tags', () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `Custom ${i}`)
    const result = spaceTagsSchema.safeParse({
      spaceId: validSpaceId,
      curatedTagIds: [],
      customTagNames: tooMany,
    })

    expect(result.success).toBe(false)
  })

  it('rejects custom tags containing forbidden characters (<, >, {, }, \\)', () => {
    for (const badTag of ['<script>', 'tag>name', '{invalid}', 'tag\\escape']) {
      const result = spaceTagsSchema.safeParse({
        spaceId: validSpaceId,
        curatedTagIds: [],
        customTagNames: [badTag],
      })

      expect(result.success).toBe(false)
    }
  })

  it('rejects duplicate custom tag names case-insensitively', () => {
    const result = spaceTagsSchema.safeParse({
      spaceId: validSpaceId,
      curatedTagIds: [],
      customTagNames: ['Coffee Bar', 'coffee bar'],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Custom tag names must be unique (case-insensitive)',
      )
    }
  })

  it('trims whitespace on custom tags and rejects empty strings', () => {
    const result = spaceTagsSchema.safeParse({
      spaceId: validSpaceId,
      curatedTagIds: [],
      customTagNames: ['  Cozy corner  '],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.customTagNames[0]).toBe('Cozy corner')
    }

    const emptyResult = spaceTagsSchema.safeParse({
      spaceId: validSpaceId,
      curatedTagIds: [],
      customTagNames: ['   '],
    })
    expect(emptyResult.success).toBe(false)
  })
})
