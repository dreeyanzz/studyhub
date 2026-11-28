import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'

/**
 * Centered floating frosted-glass studio card over the luminous daylight aurora canvas
 * for /login, /register, and /choose-role (STORY-17, STORY-21).
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby="auth-title"
      className="mx-auto flex w-full max-w-[29rem] flex-col items-center gap-4"
    >
      <div className="w-full rounded-3xl border border-white/95 bg-white/92 p-5 shadow-hero backdrop-blur-2xl sm:p-7">
        <div className="mb-4 space-y-1.5 text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
            <span>Worq Account</span>
          </p>
          <h1
            id="auth-title"
            className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground"
          >
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>

      <p
        aria-hidden="true"
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground"
      >
        <span>Verified Metro Cebu Spaces</span>
        <span>·</span>
        <span>Snap-Grid Seat Maps</span>
        <span>·</span>
        <span>Sandbox Mode</span>
      </p>
    </section>
  )
}
