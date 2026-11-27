'use client'

/**
 * PROTOTYPE: Four structurally distinct Seeker landing page proposals switchable
 * via `?variant=A|B|C|D` on `/` (with a dev-only floating bottom bar and ←/→
 * keyboard shortcuts). Remove this folder once a winning direction is chosen.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ProposalBaseline } from './proposal-baseline'
import { ProposalCommandFinder } from './proposal-command-finder'
import { ProposalCuratedHybrid } from './proposal-curated-hybrid'
import { ProposalFloorplanFirst } from './proposal-floorplan-first'
import { ProposalQuietMonograph } from './proposal-quiet-monograph'

export type LandingVariantKey = 'A' | 'B' | 'C' | 'D' | 'E'

interface VariantMeta {
  key: LandingVariantKey
  name: string
  reference: string
}

const VARIANTS: readonly VariantMeta[] = [
  {
    key: 'A',
    name: 'Command Finder',
    reference: 'Peerspace / Croissant / LiquidSpace',
  },
  {
    key: 'B',
    name: 'Quiet Monograph',
    reference: 'NeueHouse / Fosbury & Sons / Resy',
  },
  {
    key: 'C',
    name: 'Floorplan First',
    reference: 'SeatGeek / Workfrom / Swiss Blueprint',
  },
  {
    key: 'D',
    name: 'Editorial Split (Baseline)',
    reference: 'Current committed c026835',
  },
  {
    key: 'E',
    name: 'Curated Hybrid',
    reference: 'Command Hero + Manifesto + Session Tabs + Colophon',
  },
] as const

const DEFAULT_VARIANT: LandingVariantKey = 'D'
const VARIANT_EVENT = 'worq:prototype-variant-change'

function parseVariantFromSearch(search: string): LandingVariantKey {
  const raw = new URLSearchParams(search).get('variant')?.toUpperCase()
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D' || raw === 'E') {
    return raw
  }
  return DEFAULT_VARIANT
}

function subscribeVariant(onStoreChange: () => void) {
  window.addEventListener('popstate', onStoreChange)
  window.addEventListener(VARIANT_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('popstate', onStoreChange)
    window.removeEventListener(VARIANT_EVENT, onStoreChange)
  }
}

function getClientVariantSnapshot(): LandingVariantKey {
  return parseVariantFromSearch(window.location.search)
}

function getServerVariantSnapshot(): LandingVariantKey {
  return DEFAULT_VARIANT
}

export function LandingPrototypeSwitcher({
  showSwitcher = false,
}: {
  showSwitcher?: boolean
}) {
  const activeKey = useSyncExternalStore(
    subscribeVariant,
    getClientVariantSnapshot,
    getServerVariantSnapshot,
  )

  const selectVariant = useCallback((nextKey: LandingVariantKey) => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', nextKey)
    window.history.replaceState(null, '', url.toString())
    window.dispatchEvent(new Event(VARIANT_EVENT))
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const cycleVariant = useCallback(
    (delta: -1 | 1) => {
      const idx = VARIANTS.findIndex((v) => v.key === activeKey)
      const safeIdx = idx === -1 ? 0 : idx
      const next = VARIANTS[(safeIdx + delta + VARIANTS.length) % VARIANTS.length]!
      selectVariant(next.key)
    },
    [activeKey, selectVariant],
  )

  useEffect(() => {
    if (!showSwitcher) return

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        cycleVariant(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        cycleVariant(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleVariant, showSwitcher])

  const activeMeta = VARIANTS.find((v) => v.key === activeKey) ?? VARIANTS[3]!

  return (
    <>
      {activeKey === 'A' && <ProposalCommandFinder />}
      {activeKey === 'B' && <ProposalQuietMonograph />}
      {activeKey === 'C' && <ProposalFloorplanFirst />}
      {activeKey === 'D' && <ProposalBaseline />}
      {activeKey === 'E' && <ProposalCuratedHybrid />}

      {showSwitcher && (
        <aside
          aria-label="Landing page prototype variant switcher"
          className="fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-1.5rem),46rem)] -translate-x-1/2 rounded-2xl border border-[#f0c95c]/45 bg-[#11241c]/95 px-3 py-2 text-[#f8f9f3] shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => cycleVariant(-1)}
                aria-label="Previous landing page proposal"
                className="inline-flex size-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#f8f9f3] transition-colors hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>

              <div className="px-2">
                <p className="font-mono text-[11px] font-semibold tracking-wider text-[#f0c95c] uppercase">
                  Prototype {activeMeta.key} · {activeMeta.name}
                </p>
                <p className="text-xs text-white/75">{activeMeta.reference}</p>
              </div>

              <button
                type="button"
                onClick={() => cycleVariant(1)}
                aria-label="Next landing page proposal"
                className="inline-flex size-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#f8f9f3] transition-colors hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Jump to proposal"
            >
              {VARIANTS.map((variant) => {
                const selected = variant.key === activeKey
                return (
                  <button
                    key={variant.key}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Proposal ${variant.key}: ${variant.name}`}
                    onClick={() => selectVariant(variant.key)}
                    className={
                      selected
                        ? 'inline-flex size-12 items-center justify-center rounded-xl bg-[#f0c95c] font-mono text-xs font-bold text-[#173c2d] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]'
                        : 'inline-flex size-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 font-mono text-xs font-semibold text-white/85 hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]'
                    }
                  >
                    {variant.key}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>
      )}
    </>
  )
}
