import { z } from 'zod'

export const registrationRoles = ['seeker', 'host'] as const
export type RegistrationRole = (typeof registrationRoles)[number]

// Trim and lowercase first, then check the format: z.email() checks before it trims.
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: 'Email is required' })
  .pipe(z.email({ error: 'Please enter a valid email address' }))

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Password is required' }),
  // An unsafe returnUrl is dropped rather than failing the login (STORY-03 §2).
  returnUrl: z
    .string()
    .optional()
    .transform((url) => toSafePath(url) ?? undefined),
})

export type LoginInput = z.infer<typeof loginSchema>

// bcrypt, which Supabase Auth uses, reads only the first 72 bytes of a password.
const passwordSchema = z
  .string()
  .min(8, { error: 'Password must be at least 8 characters' })
  .max(72, { error: 'Password must be 72 characters or fewer' })
  .regex(/[0-9]/, { error: 'Password must contain at least one number' })
  .regex(/[^A-Za-z0-9]/, {
    error: 'Password must contain at least one symbol',
  })

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, { error: 'Full name is required' })
      .max(100, { error: 'Full name must not exceed 100 characters' }),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, { error: 'Please confirm your password' }),
    role: z.enum(registrationRoles, {
      error: 'Please select whether you are a Seeker or a Host',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterInput = z.infer<typeof registerSchema>

export function sanitizeReturnUrl(
  url: string | null | undefined,
  defaultPath: string,
): string {
  return toSafePath(url) ?? defaultPath
}

// Returns the path if it stays on this site, or null. The result is checked after
// parsing, because the URL parser turns '/.//evil.com' into '//evil.com' and drops
// tabs and newlines, and a browser reads a leading '//' as another site.
function toSafePath(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('\\')) {
    return null
  }
  if ([...url].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    return null
  }
  try {
    const parsed = new URL(url, 'http://localhost')
    const path = parsed.pathname + parsed.search + parsed.hash
    if (parsed.origin !== 'http://localhost' || path.startsWith('//')) return null
    return path
  } catch {
    return null
  }
}
