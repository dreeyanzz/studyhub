import { z } from 'zod'

export const registrationRoles = ['seeker', 'host'] as const
export type RegistrationRole = (typeof registrationRoles)[number]

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
})

export type LoginInput = z.infer<typeof loginSchema>

const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number' })
  .regex(/[^A-Za-z0-9]/, {
    message: 'Password must contain at least one symbol',
  })

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, { message: 'Email is required' })
      .email({ message: 'Invalid email address' }),
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: 'Please confirm your password' }),
    role: z.enum(registrationRoles, {
      error: 'Please select a valid role (Seeker or Host)',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterInput = z.infer<typeof registerSchema>

export function sanitizeReturnUrl(
  url: string | null | undefined,
  defaultPath: string,
): string {
  if (!url) return defaultPath
  // Must start with '/' and not '//' or '/\'
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) {
    // Ensure no control characters or protocol schemes
    try {
      const parsed = new URL(url, 'http://localhost')
      return parsed.pathname + parsed.search + parsed.hash
    } catch {
      return defaultPath
    }
  }
  return defaultPath
}
