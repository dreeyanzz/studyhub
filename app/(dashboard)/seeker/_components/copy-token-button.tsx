'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { formatToken, normalizeToken } from '@/lib/check-in/normalize'
import { cn } from '@/lib/utils'

import { WRAPPING_BUTTON } from '../reservations/[id]/_components/reservation-status-view'

/**
 * 48x48+ px Copy code control for the Seeker's Reserved card (STORY-10 design §3).
 */
export function CopyTokenButton({ token }: { token: string }) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle')
  const grouped = formatToken(normalizeToken(token))

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(grouped)
      setResult('copied')
    } catch {
      // No clipboard here (a page not served over HTTPS, or permission refused): say
      // so, and the Seeker reads the code from the screen instead.
      setResult('failed')
    }
    setTimeout(() => setResult('idle'), 2000)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        className={cn(WRAPPING_BUTTON, 'min-w-12 gap-2 px-4')}
      >
        {result === 'copied' ? (
          <Check className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <Copy className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span>
          {result === 'copied'
            ? 'Copied'
            : result === 'failed'
              ? "Couldn't copy"
              : 'Copy code'}
        </span>
      </Button>
      {/* Outside the button, so the announcement never becomes part of its name. */}
      <span className="sr-only" aria-live="polite">
        {result === 'copied'
          ? 'Booking code copied'
          : result === 'failed'
            ? "Couldn't copy the booking code"
            : ''}
      </span>
    </>
  )
}
