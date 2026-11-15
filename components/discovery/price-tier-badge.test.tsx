import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PriceTierBadge } from './price-tier-badge'

describe('PriceTierBadge (STORY-08, D-027)', () => {
  it('renders standard labels for all price tiers', () => {
    const freeHtml = renderToStaticMarkup(<PriceTierBadge tier="free" />)
    expect(freeHtml).toContain('Free')
    expect(freeHtml).toContain('price-tier-badge-free')
    expect(freeHtml).toContain('bg-emerald-100')

    const budgetHtml = renderToStaticMarkup(<PriceTierBadge tier="budget" />)
    expect(budgetHtml).toContain('Budget')
    expect(budgetHtml).toContain('price-tier-badge-budget')
    expect(budgetHtml).toContain('bg-sky-100')

    const standardHtml = renderToStaticMarkup(<PriceTierBadge tier="standard" />)
    expect(standardHtml).toContain('Standard')
    expect(standardHtml).toContain('price-tier-badge-standard')
    expect(standardHtml).toContain('bg-amber-100')

    const premiumHtml = renderToStaticMarkup(<PriceTierBadge tier="premium" />)
    expect(premiumHtml).toContain('Premium')
    expect(premiumHtml).toContain('price-tier-badge-premium')
    expect(premiumHtml).toContain('bg-purple-100')
  })

  it('renders currency symbols when showSymbol is true', () => {
    const budgetHtml = renderToStaticMarkup(<PriceTierBadge tier="budget" showSymbol />)
    expect(budgetHtml).toContain('Budget (₱)')

    const standardHtml = renderToStaticMarkup(
      <PriceTierBadge tier="standard" showSymbol />,
    )
    expect(standardHtml).toContain('Standard (₱₱)')

    const premiumHtml = renderToStaticMarkup(<PriceTierBadge tier="premium" showSymbol />)
    expect(premiumHtml).toContain('Premium (₱₱₱)')

    const freeHtml = renderToStaticMarkup(<PriceTierBadge tier="free" showSymbol />)
    expect(freeHtml).toContain('Free')
    expect(freeHtml).not.toContain('Free (Free)')
  })

  it.each(['free', 'budget', 'standard', 'premium'] as const)(
    '%s uses light colours only, with no dark: classes',
    (tier) => {
      const html = renderToStaticMarkup(<PriceTierBadge tier={tier} />)

      // The app has no dark theme (D-031), so a dark: class would follow the OS setting
      // and turn the badge into a dark pill on the light page (#309).
      expect(html).not.toContain('dark:')
    },
  )
})
