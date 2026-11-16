'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'worq-lamp-lit'
const STORAGE_EVENT = 'worq-lamp-storage'
const STARTUP_PHRASES = ['DISCOVER SPACES', 'PLAN YOUR COMFORT', 'ALL IN ONE GO'] as const

const MAX_PULL = 68
const TRIGGER_PULL = 36
const BASE_CHAIN_END = 188
const BASE_KNOB_Y = 196

function subscribeLit(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

function getLitSnapshot() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function getLitServerSnapshot() {
  return false
}

function setSessionLit(lit: boolean) {
  try {
    if (lit) {
      window.sessionStorage.setItem(STORAGE_KEY, '1')
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
    window.dispatchEvent(new Event(STORAGE_EVENT))
  } catch {
    // Ignore storage errors in restricted browsing contexts
  }
}

/**
 * Interactive desk-lamp startup overlay shown once per browser session when
 * opening Worq. Pulling or clicking the brass handle illuminates the screen
 * and reveals the landing page underneath.
 */
export function StartupLamp() {
  const isLit = useSyncExternalStore(subscribeLit, getLitSnapshot, getLitServerSnapshot)

  const [pullOffset, setPullOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [isSwapping, setIsSwapping] = useState(false)
  const [isEmerging, setIsEmerging] = useState(false)

  const startYRef = useRef(0)
  const hasMovedRef = useRef(false)
  const currentPullRef = useRef(0)

  useEffect(() => {
    if (isLit) return

    const intervalId = window.setInterval(() => {
      setIsSwapping(true)
      window.setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % STARTUP_PHRASES.length)
        setIsSwapping(false)
      }, 360)
    }, 2200)

    return () => window.clearInterval(intervalId)
  }, [isLit])

  function updatePull(dy: number) {
    const clamped = Math.max(0, Math.min(MAX_PULL, dy))
    currentPullRef.current = clamped
    setPullOffset(clamped)
  }

  function triggerLampOn() {
    if (isLit) return
    setIsEmerging(true)
    setSessionLit(true)
    window.setTimeout(() => updatePull(0), 220)
    window.setTimeout(() => setIsEmerging(false), 960)
  }

  function handlePointerDown(event: React.PointerEvent<SVGGElement>) {
    if (isLit) return
    setIsDragging(true)
    hasMovedRef.current = false
    startYRef.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<SVGGElement>) {
    if (!isDragging || isLit) return
    const dy = event.clientY - startYRef.current
    if (Math.abs(dy) > 4) hasMovedRef.current = true
    updatePull(dy)
  }

  function finishPull(event: React.PointerEvent<SVGGElement>) {
    if (!isDragging) return
    setIsDragging(false)
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Ignore release errors if pointer is already gone
    }

    if (currentPullRef.current >= TRIGGER_PULL || !hasMovedRef.current) {
      if (!hasMovedRef.current) {
        updatePull(48)
        window.setTimeout(triggerLampOn, 260)
      } else {
        window.setTimeout(triggerLampOn, 120)
      }
    } else {
      updatePull(0)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<SVGGElement>) {
    if ((event.key === 'Enter' || event.key === ' ') && !isLit) {
      event.preventDefault()
      updatePull(48)
      window.setTimeout(triggerLampOn, 260)
    }
  }

  const preGlow = pullOffset > 12
  const statusText =
    pullOffset >= TRIGGER_PULL ? 'Release to turn on the light!' : "Let's start to Worq!"

  if (isLit && !isEmerging) {
    return null
  }

  return (
    <div
      className={`startup-lamp-overlay${isLit ? 'is-lit' : ''}${preGlow ? 'pre-glow' : ''}`}
      aria-hidden={isLit}
    >
      <div className="startup-lamp-center">
        <div className="startup-phrase-bar" aria-live="polite">
          <span className={`startup-rotating-word${isSwapping ? 'is-swapping' : ''}`}>
            {STARTUP_PHRASES[phraseIndex]}
          </span>
        </div>

        <svg
          width="280"
          height="320"
          viewBox="0 0 280 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="startup-lamp-svg"
          role="img"
          aria-label="Desk lamp with a pull handle"
        >
          <defs>
            <linearGradient
              id="worqShadeGrad"
              x1="80"
              y1="62"
              x2="180"
              y2="128"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#2e7552" />
              <stop offset="55%" stopColor="#215c3f" />
              <stop offset="100%" stopColor="#143a28" />
            </linearGradient>
            <linearGradient id="worqBrassGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#b79248" />
              <stop offset="45%" stopColor="#e7cb83" />
              <stop offset="100%" stopColor="#9c7834" />
            </linearGradient>
            <linearGradient
              id="worqConeGrad"
              x1="130"
              y1="120"
              x2="130"
              y2="295"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.72" />
              <stop offset="55%" stopColor="#fde68a" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="worqDeskPool" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx="135" cy="292" rx="115" ry="12" fill="#040907" opacity="0.75" />
          <ellipse
            cx="130"
            cy="288"
            rx="95"
            ry="10"
            fill="url(#worqDeskPool)"
            className="startup-bulb-glow"
          />
          <path
            d="M78 122 L182 122 L238 286 L22 286 Z"
            fill="url(#worqConeGrad)"
            className="startup-bulb-glow"
          />

          <path
            d="M90 286 C90 274 108 268 135 268 C162 268 180 274 180 286 Z"
            fill="#183f2d"
            stroke="#2c6649"
            strokeWidth="1.5"
          />
          <rect
            x="82"
            y="284"
            width="106"
            height="9"
            rx="4.5"
            fill="url(#worqBrassGrad)"
          />

          <path
            d="M135 268 L135 190 L106 112 L126 76"
            stroke="url(#worqBrassGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="135"
            cy="190"
            r="6"
            fill="url(#worqBrassGrad)"
            stroke="#143a28"
            strokeWidth="2"
          />
          <circle
            cx="106"
            cy="112"
            r="5"
            fill="url(#worqBrassGrad)"
            stroke="#143a28"
            strokeWidth="2"
          />

          <rect x="120" y="54" width="22" height="16" rx="4" fill="url(#worqBrassGrad)" />
          <ellipse
            cx="130"
            cy="123"
            rx="14"
            ry="8"
            fill="#fef3c7"
            className="startup-bulb-glow"
          />

          <path
            d="M98 66 C98 59 162 59 162 66 L188 118 C190 123 185 126 178 126 L82 126 C75 126 70 123 72 118 Z"
            fill="url(#worqShadeGrad)"
            stroke="#3a8660"
            strokeWidth="1.5"
          />
          <path
            d="M74 123 H186"
            stroke="url(#worqBrassGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          <g
            className={`startup-pull-group${isDragging ? 'is-dragging' : ''}`}
            tabIndex={isLit ? -1 : 0}
            role="button"
            aria-label="Pull handle to turn on the Worq landing page"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPull}
            onPointerCancel={finishPull}
            onKeyDown={handleKeyDown}
          >
            <rect x="164" y="122" width="44" height="120" fill="transparent" />
            <line
              x1="185"
              y1="120"
              x2="185"
              y2={BASE_CHAIN_END}
              stroke="url(#worqBrassGrad)"
              strokeWidth="2.5"
              strokeDasharray="3 3"
              strokeLinecap="round"
              style={{
                transformOrigin: '185px 120px',
                transform: `scaleY(${(BASE_CHAIN_END - 120 + pullOffset) / (BASE_CHAIN_END - 120)})`,
                transition: isDragging
                  ? 'none'
                  : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
            <g
              style={{
                transform: `translate(185px, ${BASE_KNOB_Y + pullOffset}px)`,
                transition: isDragging
                  ? 'none'
                  : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <circle cx="0" cy="-6" r="3" fill="url(#worqBrassGrad)" />
              <rect
                x="-7"
                y="-3"
                width="14"
                height="22"
                rx="7"
                fill="url(#worqBrassGrad)"
                stroke="#143a28"
                strokeWidth="1.5"
              />
              <line
                x1="-3"
                y1="4"
                x2="3"
                y2="4"
                stroke="#143a28"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.6"
              />
              <line
                x1="-3"
                y1="8"
                x2="3"
                y2="8"
                stroke="#143a28"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.6"
              />
            </g>
          </g>
        </svg>

        <div className="startup-pull-hint">
          <p className="startup-pull-status">{statusText}</p>
          <p className="startup-pull-sub">Drag down or click the brass handle</p>
        </div>
      </div>
    </div>
  )
}
