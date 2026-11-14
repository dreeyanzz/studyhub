import { describe, expect, it } from 'vitest'
import { formatToken, normalizeToken } from './normalize'

describe('normalizeToken (STORY-10, D-059)', () => {
  it('strips hyphens and formats cleanly', () => {
    expect(normalizeToken('ABCD-EFGH-JKMN')).toBe('ABCDEFGHJKMN')
  })

  it('strips spaces', () => {
    expect(normalizeToken('ABCD EFGH JKMN')).toBe('ABCDEFGHJKMN')
  })

  it('strips dots', () => {
    expect(normalizeToken('ABCD.EFGH.JKMN')).toBe('ABCDEFGHJKMN')
  })

  it('strips other non-alphanumeric characters', () => {
    expect(normalizeToken('AB/CD_EF\\GH|JK+MN')).toBe('ABCDEFGHJKMN')
  })

  it('converts lowercase to uppercase', () => {
    expect(normalizeToken('abcdefghjkmn')).toBe('ABCDEFGHJKMN')
  })

  it('maps O and o to 0', () => {
    expect(normalizeToken('OABC-DEFG-HJoK')).toBe('0ABCDEFGHJ0K')
  })

  it('maps I and i to 1', () => {
    expect(normalizeToken('IABC-DEFG-HJiK')).toBe('1ABCDEFGHJ1K')
  })

  it('maps L and l to 1', () => {
    expect(normalizeToken('LABC-DEFG-HJlK')).toBe('1ABCDEFGHJ1K')
  })

  it('maps mixed ambiguous characters in a single pass', () => {
    // O→0, I→1, L→1 together
    expect(normalizeToken('OILABCDEFGHJKM')).toBe('011ABCDEFGHJKM')
  })

  it('is idempotent: normalizing an already-normalized token returns the same value', () => {
    const token = 'ABCDEFGHJKMN'
    expect(normalizeToken(token)).toBe(token)
    expect(normalizeToken(normalizeToken('abcd-efgh-jkmn'))).toBe(
      normalizeToken('abcd-efgh-jkmn'),
    )
  })

  it('returns empty string for empty input', () => {
    expect(normalizeToken('')).toBe('')
  })

  it('returns cleaned but short string when input is too short (Zod validates length)', () => {
    expect(normalizeToken('ABCD')).toBe('ABCD')
  })

  it('handles digits in the input correctly', () => {
    expect(normalizeToken('1234-5678-90AB')).toBe('1234567890AB')
  })
})

describe('formatToken (STORY-10, D-059)', () => {
  it('formats a 12-character token into ABCD-EFGH-JKMN groups', () => {
    expect(formatToken('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN')
  })

  it('formats a numeric token', () => {
    expect(formatToken('123456789012')).toBe('1234-5678-9012')
  })

  it('formats correctly regardless of content', () => {
    expect(formatToken('000000000000')).toBe('0000-0000-0000')
  })
})
