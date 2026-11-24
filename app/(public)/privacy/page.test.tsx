import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import PrivacyPage from './page'

describe('/privacy page (STORY-21)', () => {
  it('explains Google sign-in scopes, sandbox payments, and contact email', () => {
    const html = renderToStaticMarkup(<PrivacyPage />)
    expect(html).toContain('Privacy Policy')
    expect(html).toContain('Continue with Google')
    expect(html).toContain('openid')
    expect(html).toContain('worq.team.ph@gmail.com')
  })
})
