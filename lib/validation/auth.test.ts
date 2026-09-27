import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema, sanitizeReturnUrl } from './auth'

const BACKSLASH = '\\'

const validRegistration = {
  fullName: 'Rosa Villareal',
  email: 'new-seeker@example.test',
  password: 'SecurePassword1!',
  confirmPassword: 'SecurePassword1!',
  role: 'seeker',
}

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

  it('trims and lowercases the email', () => {
    const result = loginSchema.safeParse({
      email: '  Seeker@Example.TEST  ',
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
      expect(issue?.message).toBe('Please enter a valid email address')
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

  it('keeps a safe returnUrl', () => {
    const result = loginSchema.safeParse({
      email: 'seeker@example.test',
      password: 'Password123!',
      returnUrl: '/host/spaces',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.returnUrl).toBe('/host/spaces')
    }
  })

  it('drops an unsafe returnUrl without failing the login', () => {
    const result = loginSchema.safeParse({
      email: 'seeker@example.test',
      password: 'Password123!',
      returnUrl: '/.//evil.com',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.returnUrl).toBeUndefined()
    }
  })
})

describe('registerSchema', () => {
  it('passes with valid seeker registration data', () => {
    const result = registerSchema.safeParse(validRegistration)
    expect(result.success).toBe(true)
  })

  it('passes with valid host registration data', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      email: 'new-host@example.test',
      role: 'host',
    })
    expect(result.success).toBe(true)
  })

  it('trims the full name', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      fullName: '  Rosa Villareal  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.fullName).toBe('Rosa Villareal')
    }
  })

  it('fails when the full name is empty or whitespace only', () => {
    const result = registerSchema.safeParse({ ...validRegistration, fullName: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'fullName')
      expect(issue?.message).toBe('Full name is required')
    }
  })

  it('fails when the full name exceeds 100 characters', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      fullName: 'A'.repeat(101),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'fullName')
      expect(issue?.message).toBe('Full name must not exceed 100 characters')
    }
  })

  it('fails when password is less than 8 characters', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: 'Pass1!',
      confirmPassword: 'Pass1!',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('Password must be at least 8 characters')
    }
  })

  it('passes at exactly 72 characters and fails at 73', () => {
    const at72 = 'Aa1!'.repeat(18)
    expect(
      registerSchema.safeParse({
        ...validRegistration,
        password: at72,
        confirmPassword: at72,
      }).success,
    ).toBe(true)

    const at73 = at72 + 'x'
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: at73,
      confirmPassword: at73,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('Password must be 72 characters or fewer')
    }
  })

  it('fails when password lacks a number', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: 'PasswordNoNumber!',
      confirmPassword: 'PasswordNoNumber!',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('Password must contain at least one number')
    }
  })

  it('fails when password lacks a symbol', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: 'Password12345',
      confirmPassword: 'Password12345',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('Password must contain at least one symbol')
    }
  })

  it('fails when passwords do not match', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: 'Password123!',
      confirmPassword: 'DifferentPassword123!',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'confirmPassword')
      expect(issue?.message).toBe('Passwords do not match')
    }
  })

  it('fails when attempting to register as admin (SRS §3.5.1, STORY-01)', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      email: 'attacker@example.test',
      role: 'admin',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'role')
      expect(issue?.message).toBe('Please select whether you are a Seeker or a Host')
    }
  })

  it('fails when role is not a valid enum value', () => {
    const result = registerSchema.safeParse({ ...validRegistration, role: 'superman' })
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

  it('rejects a backslash anywhere in the url', () => {
    expect(sanitizeReturnUrl(`/${BACKSLASH}evil.com`, '/seeker')).toBe('/seeker')
    expect(sanitizeReturnUrl(`/.${BACKSLASH}${BACKSLASH}evil.com`, '/seeker')).toBe(
      '/seeker',
    )
    expect(sanitizeReturnUrl(`/seeker${BACKSLASH}x`, '/seeker')).toBe('/seeker')
  })

  it('rejects paths that normalize to //evil.com', () => {
    expect(sanitizeReturnUrl('/.//evil.com', '/seeker')).toBe('/seeker')
    expect(sanitizeReturnUrl('/a/..//evil.com', '/seeker')).toBe('/seeker')
    expect(sanitizeReturnUrl('/..//evil.com', '/seeker')).toBe('/seeker')
  })

  it('rejects control characters that the URL parser would strip', () => {
    expect(sanitizeReturnUrl('/\t/evil.com', '/seeker')).toBe('/seeker')
    expect(sanitizeReturnUrl('/\n/evil.com', '/seeker')).toBe('/seeker')
  })
})
