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
  const [copied, setCopied] = useState(false)
  const grouped = formatToken(normalizeToken(token))

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(grouped)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleCopy}
      className={cn(WRAPPING_BUTTON, 'min-w-12 gap-2 px-4')}
    >
      {copied ? (
        <Check className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Copy className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span>{copied ? 'Copied' : 'Copy code'}</span>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Booking code copied' : ''}
      </span>
    </Button>
  )
}
