import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  it('lets a later Tailwind class override an earlier one', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'c')).toBe('a c')
  })
})
