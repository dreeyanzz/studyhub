'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { normalizeToken } from '@/lib/check-in/normalize'

interface DetectedBarcode {
  rawValue?: string
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
}

type WindowWithBarcode = Window & {
  BarcodeDetector?: BarcodeDetectorCtor
}

type ScannerState = 'prompt' | 'starting' | 'active' | 'unavailable'

const SCAN_INTERVAL_MS = 200
/** How long a code must be out of frame before the same code can submit again. */
const SAME_CODE_GAP_MS = 2500

export interface LastScan {
  value: string
  /** When the scanner last saw this code, in ms. */
  seenAt: number
}

/**
 * Whether one sighting of `candidate` submits, and what to remember after it (design §3:
 * "auto-submits on recognized QR code without double-triggering").
 *
 * A code the scanner keeps seeing is the same Seeker still holding it up, so it submits
 * once and never again until it has been out of frame for SAME_CODE_GAP_MS. Without
 * this, a check-in that succeeded was submitted again 2.5 s later and its banner turned
 * into "Already checked in". While a check-in is pending, a new code waits for it to
 * finish, and is not remembered, so it submits as soon as the answer arrives.
 */
export function nextScan(
  last: LastScan,
  candidate: string,
  now: number,
  pending: boolean,
): { submit: boolean; last: LastScan } {
  if (last.value === candidate && now - last.seenAt < SAME_CODE_GAP_MS) {
    return { submit: false, last: { value: candidate, seenAt: now } }
  }
  if (pending) return { submit: false, last }
  return { submit: true, last: { value: candidate, seenAt: now } }
}

interface CameraScannerProps {
  onDetected: (rawToken: string) => void
  isPending: boolean
  onUseManual: () => void
}

/**
 * In-portal QR camera viewfinder using the web-standard BarcodeDetector API
 * (STORY-10 design §3, §7, D-059, D-060).
 */
export function CameraScanner({
  onDetected,
  isPending,
  onUseManual,
}: CameraScannerProps) {
  const [scannerState, setScannerState] = useState<ScannerState>('prompt')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isPendingRef = useRef(isPending)
  const onDetectedRef = useRef(onDetected)
  const lastScanRef = useRef<LastScan>({ value: '', seenAt: 0 })

  useEffect(() => {
    isPendingRef.current = isPending
  }, [isPending])

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScannerState('unavailable')
      return
    }
    setScannerState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setScannerState('active')
    } catch {
      stopTracks()
      setScannerState('unavailable')
    }
  }, [stopTracks])

  useEffect(() => {
    let cancelled = false
    async function checkCameraPermission() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setScannerState('unavailable')
        return
      }
      if (!navigator.permissions?.query) return
      try {
        const status = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        })
        if (cancelled) return
        if (status.state === 'granted') {
          void startCamera()
        } else if (status.state === 'denied') {
          setScannerState('unavailable')
        }
      } catch {
        // Permissions API for 'camera' is optional across browsers; keep prompt button.
      }
    }
    void checkCameraPermission()
    return () => {
      cancelled = true
    }
  }, [startCamera])

  useEffect(() => {
    if (scannerState !== 'active') return

    const video = videoRef.current
    const stream = streamRef.current
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream
      void video.play().catch(() => {
        // Autoplay promise rejections on muted inline video are safe to ignore.
      })
    }

    const BarcodeDetectorApi = (window as WindowWithBarcode).BarcodeDetector
    if (!BarcodeDetectorApi) {
      return
    }
    const detector = new BarcodeDetectorApi({ formats: ['qr_code'] })
    let cancelled = false
    let detecting = false

    // Frames are read while a check-in is pending too, so a code still in frame keeps
    // its "last seen" time fresh and is not submitted again when the answer arrives.
    const timer = window.setInterval(() => {
      if (cancelled || detecting || !video || video.readyState < 2) {
        return
      }
      detecting = true
      void detector
        .detect(video)
        .then((codes) => {
          if (cancelled) return
          const rawValue = codes.find(
            (c) => typeof c.rawValue === 'string' && c.rawValue.trim(),
          )?.rawValue
          if (!rawValue) return

          const trimmed = rawValue.trim()
          const normalized = normalizeToken(trimmed)
          const candidate = normalized.length > 0 ? normalized : trimmed

          const scan = nextScan(
            lastScanRef.current,
            candidate,
            Date.now(),
            isPendingRef.current,
          )
          lastScanRef.current = scan.last
          if (scan.submit) onDetectedRef.current(candidate)
        })
        .catch(() => {
          // Ignore transient frame decode errors while camera focuses.
        })
        .finally(() => {
          detecting = false
        })
    }, SCAN_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [scannerState])

  useEffect(() => {
    return () => {
      stopTracks()
    }
  }, [stopTracks])

  if (scannerState === 'unavailable') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
        <CameraOff className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">
          Camera unavailable. Use manual code entry below.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onUseManual}
          className="h-auto min-h-12 min-w-12 px-4 py-2 text-center whitespace-normal"
        >
          Use Manual Entry
        </Button>
      </div>
    )
  }

  if (scannerState === 'prompt' || scannerState === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
        <Camera className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Point your device camera at the Seeker&apos;s booking QR code to check them in
          immediately.
        </p>
        <Button
          type="button"
          onClick={() => void startCamera()}
          disabled={scannerState === 'starting'}
          className="h-auto min-h-12 min-w-12 px-5 py-2.5 text-center whitespace-normal"
        >
          {scannerState === 'starting'
            ? 'Starting camera…'
            : 'Allow camera access to scan booking QR codes'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl border-2 border-primary/70 bg-muted">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="QR code camera viewfinder"
          className="h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-primary-foreground/80 shadow-xs"
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {isPending
          ? 'Checking booking token…'
          : 'Center the Seeker’s QR code inside the frame. It submits automatically.'}
      </p>
    </div>
  )
}
