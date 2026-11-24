import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HISTORY_SHOW_COUNT,
  HISTORY_SHOW_COUNTS,
  historyPageSchema,
} from './history'

describe('historyPageSchema (STORY-16 design §2 & §4)', () => {
  it('defaults to 20 when show is omitted or empty', () => {
    expect(historyPageSchema.parse({})).toEqual({ show: DEFAULT_HISTORY_SHOW_COUNT })
    expect(historyPageSchema.parse({ show: undefined })).toEqual({
      show: DEFAULT_HISTORY_SHOW_COUNT,
    })
    expect(historyPageSchema.parse({ show: '' })).toEqual({
      show: DEFAULT_HISTORY_SHOW_COUNT,
    })
  })

  it('accepts valid show values as numbers', () => {
    for (const count of HISTORY_SHOW_COUNTS) {
      expect(historyPageSchema.parse({ show: count })).toEqual({ show: count })
    }
  })

  it('accepts valid show values as strings', () => {
    for (const count of HISTORY_SHOW_COUNTS) {
      expect(historyPageSchema.parse({ show: String(count) })).toEqual({ show: count })
      expect(historyPageSchema.parse({ show: ` ${count} ` })).toEqual({ show: count })
    }
  })

  it('picks the first element if passed as an array', () => {
    expect(historyPageSchema.parse({ show: ['40', '60'] })).toEqual({ show: 40 })
  })

  it('falls back to 20 on invalid or out-of-step values', () => {
    expect(historyPageSchema.parse({ show: '0' })).toEqual({ show: 20 })
    expect(historyPageSchema.parse({ show: '10' })).toEqual({ show: 20 })
    expect(historyPageSchema.parse({ show: '30' })).toEqual({ show: 20 })
    expect(historyPageSchema.parse({ show: '50' })).toEqual({ show: 20 })
    expect(historyPageSchema.parse({ show: '120' })).toEqual({ show: 20 })
    expect(historyPageSchema.parse({ show: '-20' })).toEqual({ show: 20 })
    expect(historyPageSchema.parse({ show: 'abc' })).toEqual({ show: 20 })
    expect(historyPageSchema.parse({ show: null })).toEqual({ show: 20 })
  })
})
