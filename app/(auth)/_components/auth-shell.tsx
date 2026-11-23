import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'

const highlights = [
  'Browse verified study and co-working Spaces',
  'Pick an exact unit on the snap-grid seat map',
  'Hold now with a sandbox fee and QR check-in',
]

/**
 * Shared split-panel shell for /login and /register (STORY-17).
 * Stacks cleanly at 360 px and uses a two-column editorial card on md+ screens.
 */
export function AuthShell({
  asideEyebrow,
  asideTitle,
  asideBody,
  title,
  subtitle,
  children,
}: {
  asideEyebrow: string
  asideTitle: string
  asideBody: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <Card className="w-full max-w-4xl self-start overflow-hidden p-0">
      <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <aside className="flex flex-col justify-between gap-6 bg-primary p-6 text-primary-foreground sm:p-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-primary-foreground/85 uppercase">
              {asideEyebrow}
            </p>
            <h2 className="font-heading text-2xl leading-snug font-semibold sm:text-3xl">
              {asideTitle}
            </h2>
            <p className="text-sm leading-relaxed text-primary-foreground/90">
              {asideBody}
            </p>
          </div>
          <ul className="hidden space-y-2.5 border-t border-primary-foreground/20 pt-5 text-sm text-primary-foreground/90 md:block">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-foreground"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="space-y-1.5">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="text-base text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            Reservation fees run in sandbox mode, so no real money moves.
          </p>
        </div>
      </div>
    </Card>
  )
}
