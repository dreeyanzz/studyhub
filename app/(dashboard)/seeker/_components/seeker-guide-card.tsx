import Link from 'next/link'
import { Clock, QrCode, ShieldCheck, Timer } from 'lucide-react'

/**
 * Compact Seeker hold-rules & trust companion card below ProfileForm on /seeker.
 * Explains Worq's actual hold lifecycle (D-005, STORY-09, STORY-10) without fake widgets.
 */
export function SeekerGuideCard() {
  return (
    <section
      aria-labelledby="seeker-guide-heading"
      className="space-y-4 rounded-3xl border border-border/80 bg-card p-6 shadow-card"
    >
      <div className="space-y-1">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-brass-soft px-3 py-0.5 text-xs font-semibold text-brass-foreground">
          <ShieldCheck aria-hidden="true" className="size-3.5 text-brass-border" />
          <span>Hold Essentials</span>
        </p>
        <h2
          id="seeker-guide-heading"
          className="font-heading text-lg font-bold tracking-[-0.02em] text-foreground"
        >
          Before you head out
        </h2>
      </div>

      <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
        <li className="flex items-start gap-3 rounded-2xl border border-border/65 bg-surface-subtle/70 p-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"
          >
            <Timer className="size-4" />
          </span>
          <div>
            <p className="font-semibold text-foreground">10-minute checkout window</p>
            <p>
              Complete sandbox payment within 10 minutes of holding a unit before it
              releases.
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3 rounded-2xl border border-border/65 bg-surface-subtle/70 p-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"
          >
            <QrCode className="size-4" />
          </span>
          <div>
            <p className="font-semibold text-foreground">Front-desk QR check-in</p>
            <p>
              Show your booking QR or recite your 12-character code before the wait window
              lapses.
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3 rounded-2xl border border-border/65 bg-surface-subtle/70 p-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-brass-soft text-brass-foreground"
          >
            <Clock className="size-4" />
          </span>
          <div>
            <p className="font-semibold text-foreground">One active hold at a time</p>
            <p>
              Check out when your study session wraps up so another Seeker can claim the
              seat.
            </p>
          </div>
        </li>
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span>Sandbox mode · No real money moves</span>
        <Link
          href="/privacy"
          className="inline-flex min-h-12 min-w-12 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Privacy Policy
        </Link>
      </div>
    </section>
  )
}
