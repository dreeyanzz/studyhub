'use client'

import { useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeToken } from '@/lib/check-in/normalize'

const TOKEN_LENGTH = 12

/**
 * Formats user typing into uppercase Crockford-normalized 4-character blocks
 * (`ABCD-EFGH-JKMN`) while keeping Backspace seamless at hyphen boundaries.
 */
export function formatManualTokenInput(raw: string): string {
  const clean = normalizeToken(raw).slice(0, TOKEN_LENGTH)
  const blocks: string[] = []
  for (let i = 0; i < clean.length; i += 4) {
    blocks.push(clean.slice(i, i + 4))
  }
  return blocks.join('-')
}

interface ManualEntryFormProps {
  onSubmitToken: (rawToken: string) => void
  isPending: boolean
}

/**
 * Keyboard-first manual booking token entry form (STORY-10 design §3, TSK-10.4).
 */
export function ManualEntryForm({ onSubmitToken, isPending }: ManualEntryFormProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const normalized = normalizeToken(value).slice(0, TOKEN_LENGTH)
  const canSubmit = normalized.length === TOKEN_LENGTH && !isPending

  function handleChange(nextRaw: string) {
    setValue(formatManualTokenInput(nextRaw))
  }

  function handleClear() {
    setValue('')
    inputRef.current?.focus()
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmitToken(normalized)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="booking-token-input" className="text-sm font-medium">
          Booking token
        </Label>
        <Input
          ref={inputRef}
          id="booking-token-input"
          name="token"
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="ABCD-EFGH-JKMN"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={14}
          aria-describedby="booking-token-help"
          className="font-mono text-lg tracking-widest uppercase md:text-lg"
        />
        <p id="booking-token-help" className="text-xs text-muted-foreground">
          Enter the 12-character code shown on the Seeker&apos;s hold card. Hyphens and
          spaces are added or ignored automatically ({normalized.length}/{TOKEN_LENGTH}).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-auto min-h-12 min-w-12 flex-1 px-5 py-2.5 text-center whitespace-normal sm:flex-initial"
        >
          {isPending ? 'Checking in…' : 'Check In'}
        </Button>

        {value.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={isPending}
            className="h-auto min-h-12 min-w-12 gap-2 px-4 py-2 text-center whitespace-normal"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  )
}
