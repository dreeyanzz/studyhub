import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema, sanitizeReturnUrl } from './auth'

describe('loginSchema', () => {
  it('passes with valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'seeker@example.test',
      password: 'Password123!',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('seeker@example.test')
    }
  })

  it('trims whitespace from email', () => {
    const result = loginSchema.safeParse({
      email: '  seeker@example.test  ',
      password: 'Password123!',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('seeker@example.test')
    }
  })

  it('fails with invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'Password123!',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'email')
      expect(issue?.message).toBe('Invalid email address')
    }
  })

  it('fails with empty password', () => {
    const result = loginSchema.safeParse({
      email: 'seeker@example.test',
      password: ``,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('Password is required')
    }
  })
})

describe('registerSchema', () => {
  it('passes with valid seeker registration data', () => {
    const result = registerSchema.safeParse({
      email: 'new-seeker@example.test',
      password: 'SecurePassword1!',
      confirmPassword: 'SecurePassword1!',
      role: 'seeker',
    })
    expect(result.success).toBe(true)
  })

  it('passes with valid host registration data', () => {
    const result = registerSchema.safeParse({
      email: 'new-host@example.test',
      password: 'SecurePassword1!',
      confirmPassword: 'SecurePassword1!',
      role: 'host',
    })
    expect(result.success).toBe(true)
  })

  it('fails when password is less than 8 characters', () => {
    const result = registerSchema.safeParse({
      email: 'seeker@example.test',
      password: 'Pass1!',
      confirmPassword: 'Pass1!',
      role: 'seeker',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('Password must be at least 8 characters')
    }
  })

  it('fails when password lacks a number', () => {
    const result = registerSchema.safeParse({
      email: 'seeker@example.test',
      password: 'PasswordNoNumber!',
      confirmPassword: 'PasswordNoNumber!',
      role: 'seeker',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('Password must contain at least one number')
    }
  })

  it('fails when password lacks a symbol', () => {
    const result = registerSchema.safeParse({
      email: 'seeker@example.test',
      password: 'Password12345',
      confirmPassword: 'Password12345',
      role: 'seeker',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('Password must contain at least one symbol')
    }
  })

  it('fails when passwords do not match', () => {
    const result = registerSchema.safeParse({
      email: 'seeker@example.test',
      password: 'Password123!',
      confirmPassword: 'DifferentPassword123!',
      role: 'seeker',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'confirmPassword')
      expect(issue?.message).toBe('Passwords do not match')
    }
  })

  it('fails when attempting to register as admin (D-013, STORY-01)', () => {
    const result = registerSchema.safeParse({
      email: 'attacker@example.test',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      role: 'admin',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'role')
      expect(issue).toBeDefined()
    }
  })

  it('fails when role is not a valid enum value', () => {
    const result = registerSchema.safeParse({
      email: 'seeker@example.test',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      role: 'superman',
    })
    expect(result.success).toBe(false)
  })
})

describe('sanitizeReturnUrl', () => {
  it('allows safe relative paths', () => {
    expect(sanitizeReturnUrl('/seeker', '/seeker')).toBe('/seeker')
    expect(sanitizeReturnUrl('/host/spaces?sort=name#top', '/host')).toBe(
      '/host/spaces?sort=name#top',
    )
  })

  it('falls back to defaultPath when url is empty or null', () => {
    expect(sanitizeReturnUrl(null, '/seeker')).toBe('/seeker')
    expect(sanitizeReturnUrl(undefined, '/seeker')).toBe('/seeker')
    expect(sanitizeReturnUrl('', '/seeker')).toBe('/seeker')
  })

  it('rejects external absolute URLs (open redirect)', () => {
    expect(sanitizeReturnUrl('https://evil.com', '/seeker')).toBe('/seeker')
    expect(sanitizeReturnUrl('http://attacker.test/login', '/seeker')).toBe('/seeker')
  })

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(sanitizeReturnUrl('//evil.com', '/seeker')).toBe('/seeker')
  })

  it('rejects backslash evasion attempts (/\\evil.com)', () => {
    expect(sanitizeReturnUrl('/\\evil.com', '/seeker')).toBe('/seeker')
  })
})
