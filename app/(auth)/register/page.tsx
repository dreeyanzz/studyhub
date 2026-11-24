import type { Metadata } from 'next'
import Link from 'next/link'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { parseRegistrationRole, sanitizeReturnUrl } from '@/lib/validation/auth'

import { GoogleAuthButton } from '../_components/google-auth-button'
import { RegisterForm } from './_components/register-form'

export const metadata: Metadata = { title: 'Sign up' }

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

function oauthErrorNotice(error: string | undefined) {
  if (error === 'oauth-cancelled') {
    return {
      variant: 'default' as const,
      role: 'status' as const,
      message: 'Google sign-in was cancelled. Try again, or use your email and password.',
    }
  }
  if (error === 'oauth') {
    return {
      variant: 'destructive' as const,
      role: 'alert' as const,
      message:
        'We could not sign you in with Google. Try again, or use your email and password.',
    }
  }
  return null
}

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const params = await searchParams
  // A hold prompt sends people here with its Space profile and the Seeker role
  // (D-058, STORY-09); the landing page's "Become a Host" sends the Host role. The
  // role only preselects a radio: register validates the submitted role again, and
  // never accepts admin (D-013). register checks returnUrl again.
  const returnUrl = sanitizeReturnUrl(first(params.returnUrl), '')
  const defaultRole = parseRegistrationRole(first(params.role))
  const notice = oauthErrorNotice(first(params.error))
  const loginHref = returnUrl
    ? `/login?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/login'

  return (
    <Card className="w-full max-w-md min-w-0 self-start">
      <CardHeader>
        <h1 className="font-heading text-3xl font-semibold">Create your account</h1>
        <p className="text-base text-muted-foreground">
          Join Worq as a Seeker or a Host.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {notice && (
          <Alert variant={notice.variant} role={notice.role}>
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        )}
        <GoogleAuthButton
          source="/register"
          returnUrl={returnUrl}
          defaultRole={defaultRole}
        />
        <RegisterForm returnUrl={returnUrl} defaultRole={defaultRole} />
        <p className="flex flex-wrap items-center gap-x-1 text-sm">
          Already have an account?
          <Link href={loginHref} className={buttonVariants({ variant: 'link' })}>
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
