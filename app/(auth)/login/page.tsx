import type { Metadata } from 'next'
import Link from 'next/link'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { sanitizeReturnUrl } from '@/lib/validation/auth'

import { GoogleAuthButton } from '../_components/google-auth-button'
import { LoginForm } from './_components/login-form'

export const metadata: Metadata = { title: 'Log in' }

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

function errorNotice(error: string | undefined) {
  switch (error) {
    case 'link':
      return {
        variant: 'default' as const,
        role: 'status' as const,
        message: 'That link is invalid or has expired. Log in, or sign up again.',
      }
    case 'oauth-cancelled':
      return {
        variant: 'default' as const,
        role: 'status' as const,
        message:
          'Google sign-in was cancelled. Try again, or use your email and password.',
      }
    case 'oauth':
      return {
        variant: 'destructive' as const,
        role: 'alert' as const,
        message:
          'We could not sign you in with Google. Try again, or use your email and password.',
      }
    default:
      return null
  }
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  // proxy.ts sends people here with the page they wanted; login checks it again.
  const returnUrl = sanitizeReturnUrl(first(params.returnUrl), '')
  const notice = errorNotice(first(params.error))
  // Signing up instead keeps the page they wanted (D-058).
  const registerHref = returnUrl
    ? `/register?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/register'

  return (
    <Card className="w-full max-w-md min-w-0 self-start">
      <CardHeader>
        <h1 className="font-heading text-3xl font-semibold">Log in</h1>
        <p className="text-base text-muted-foreground">Welcome back to Worq.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {notice && (
          <Alert variant={notice.variant} role={notice.role}>
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        )}
        <GoogleAuthButton source="/login" returnUrl={returnUrl} />
        <LoginForm returnUrl={returnUrl} />
        <p className="flex flex-wrap items-center gap-x-1 text-sm">
          New to Worq?
          <Link href={registerHref} className={buttonVariants({ variant: 'link' })}>
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
