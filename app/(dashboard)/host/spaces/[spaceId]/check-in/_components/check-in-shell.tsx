'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { Camera, Keyboard } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { checkInAction, type CheckInResult } from '../actions'
import { CameraScanner } from './camera-scanner'
import { CheckInResultBanner } from './check-in-result-banner'
import { ManualEntryForm } from './manual-entry-form'

const noopSubscribe = () => () => {}

function getBarcodeDetectorSupport(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

function getServerBarcodeSupport(): boolean {
  return false
}

type CheckInTab = 'scanner' | 'manual'

interface CheckInShellProps {
  spaceId: string
  spaceName: string
}

/**
 * Interactive Host Check-in portal shell managing capability-detected Camera Scanner
 * vs Manual Entry tabs, Server Action submission, and C1–C7 banners (STORY-10 design §3).
 */
export function CheckInShell({ spaceId, spaceName }: CheckInShellProps) {
  const supportsScanner = useSyncExternalStore(
    noopSubscribe,
    getBarcodeDetectorSupport,
    getServerBarcodeSupport,
  )
  const [selectedTab, setSelectedTab] = useState<CheckInTab | null>(null)
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [formResetKey, setFormResetKey] = useState(0)
  const [isPending, startTransition] = useTransition()

  const activeTab: CheckInTab = supportsScanner ? (selectedTab ?? 'scanner') : 'manual'

  function handleSubmitToken(rawToken: string) {
    startTransition(async () => {
      const outcome = await checkInAction(spaceId, rawToken)
      setResult(outcome)
      if (outcome.outcome === 'success') {
        setFormResetKey((prev) => prev + 1)
      }
    })
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <CheckInResultBanner spaceId={spaceId} result={result} />

      <Card>
        <CardHeader className="space-y-1.5">
          <CardTitle>Verify booking at {spaceName}</CardTitle>
          <CardDescription>
            Scan a Seeker&apos;s QR code or enter their 12-character booking code to check
            them in.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {supportsScanner ? (
            <div
              role="tablist"
              aria-label="Check-in methods"
              className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1"
            >
              <button
                type="button"
                role="tab"
                id="tab-camera-scanner"
                aria-selected={activeTab === 'scanner'}
                aria-controls="panel-camera-scanner"
                onClick={() => setSelectedTab('scanner')}
                className={cn(
                  'inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-3 py-2 text-center text-sm font-medium whitespace-normal transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                  activeTab === 'scanner'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Camera className="size-4 shrink-0" aria-hidden="true" />
                Camera Scanner
              </button>

              <button
                type="button"
                role="tab"
                id="tab-manual-entry"
                aria-selected={activeTab === 'manual'}
                aria-controls="panel-manual-entry"
                onClick={() => setSelectedTab('manual')}
                className={cn(
                  'inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-3 py-2 text-center text-sm font-medium whitespace-normal transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                  activeTab === 'manual'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Keyboard className="size-4 shrink-0" aria-hidden="true" />
                Manual Entry
              </button>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              This browser can&apos;t scan QR codes. Type the code instead.
            </p>
          )}

          {activeTab === 'scanner' && supportsScanner ? (
            <div
              id="panel-camera-scanner"
              role="tabpanel"
              aria-labelledby="tab-camera-scanner"
              className="space-y-6"
            >
              <CameraScanner
                onDetected={handleSubmitToken}
                isPending={isPending}
                onUseManual={() => setSelectedTab('manual')}
              />
              <div className="border-t border-border pt-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  Or type the booking token manually
                </p>
                <ManualEntryForm
                  key={`fallback-${formResetKey}`}
                  onSubmitToken={handleSubmitToken}
                  isPending={isPending}
                />
              </div>
            </div>
          ) : (
            <div
              id="panel-manual-entry"
              role="tabpanel"
              aria-labelledby={supportsScanner ? 'tab-manual-entry' : undefined}
            >
              <ManualEntryForm
                key={`manual-${formResetKey}`}
                onSubmitToken={handleSubmitToken}
                isPending={isPending}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
