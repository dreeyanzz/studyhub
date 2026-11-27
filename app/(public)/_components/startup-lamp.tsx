'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

export interface StartupLampCheckInput {
  reducedMotion: boolean
}

/**
 * Checks whether the decorative startup lamp may play (STORY-17 §3).
 * Skips when reduced motion is enabled.
 */
export function canShowStartupLamp(input: StartupLampCheckInput): boolean {
  return !input.reducedMotion
}

/**
 * Purely decorative presentation markup for the startup lamp overlay.
 * Kept `aria-hidden="true"` and `pointer-events: none` with zero focusable
 * controls so clicks and Tab always reach `/` underneath (STORY-17 §3 & §7).
 */
export function StartupLampOverlay({ fading }: { fading: boolean }) {
  return (
    <div
      className={cn('startup-lamp-overlay', fading && 'is-lit')}
      aria-hidden="true"
      data-testid="startup-lamp-overlay"
    >
      <div className="startup-lamp-center">
        <p className="startup-phrase-bar">DISCOVER SPACES</p>

        <svg
          width="280"
          height="320"
          viewBox="0 0 280 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="startup-lamp-svg"
          aria-hidden="true"
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

          <g className="startup-pull-group">
            <line
              x1="185"
              y1="120"
              x2="185"
              y2="188"
              stroke="url(#worqBrassGrad)"
              strokeWidth="2.5"
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
            <g transform="translate(185, 196)">
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
      </div>
    </div>
  )
}

/**
 * Decorative desk-lamp intro shown on every load/reload of `/` (STORY-17 §3).
 * Renders nothing on the server or without JavaScript, skips under reduced motion,
 * never blocks clicks or Tab, and fades out within ~1 s.
 */
export function StartupLamp() {
  const [phase, setPhase] = useState<'idle' | 'showing' | 'fading'>('idle')

  useEffect(() => {
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!canShowStartupLamp({ reducedMotion })) {
      return
    }

    let fadeTimer: number | undefined
    let doneTimer: number | undefined
    const frameId = window.requestAnimationFrame(() => {
      setPhase('showing')
      fadeTimer = window.setTimeout(() => setPhase('fading'), 350)
      doneTimer = window.setTimeout(() => setPhase('idle'), 1050)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer)
      if (doneTimer !== undefined) window.clearTimeout(doneTimer)
    }
  }, [])

  if (phase === 'idle') {
    return null
  }

  return <StartupLampOverlay fading={phase === 'fading'} />
}
