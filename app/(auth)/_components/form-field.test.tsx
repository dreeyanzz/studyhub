import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FormField } from './form-field'

describe('FormField (STORY-17)', () => {
  it('renders a 48x48 px visibility toggle with border-input for password fields', () => {
    const html = renderToStaticMarkup(
      <FormField id="password" label="Password" type="password" />,
    )

    expect(html).toContain('border-input')
    expect(html).toContain('aria-controls="password"')
    expect(html).toContain('aria-label="Show characters"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('size-12')
  })

  it('gives Confirm password a distinct toggle label without colliding with Password', () => {
    const html = renderToStaticMarkup(
      <FormField id="confirmPassword" label="Confirm password" type="password" />,
    )

    expect(html).toContain('aria-controls="confirmPassword"')
    expect(html).toContain('aria-label="Show confirmation characters"')
  })

  it('does not render a visibility toggle for non-password inputs', () => {
    const html = renderToStaticMarkup(<FormField id="email" label="Email" type="email" />)

    expect(html).toContain('border-input')
    expect(html).not.toContain('aria-pressed')
    expect(html).not.toContain('<button')
  })
})
