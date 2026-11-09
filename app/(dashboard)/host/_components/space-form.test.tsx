import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SpaceForm } from './space-form'

describe('SpaceForm component (STORY-05, STORY-09 TSK-09.7)', () => {
  const dummyAction = vi.fn(async () => ({}))

  it('renders create mode with Longest wait window select defaulting to 60 minutes (1 hr)', () => {
    const html = renderToStaticMarkup(<SpaceForm mode="create" action={dummyAction} />)

    // Label and hint
    expect(html).toContain('Longest wait window')
    expect(html).toContain(
      'Seekers can ask you to keep a paid unit for up to this long while they travel.',
    )

    // Control name, id, and aria link to hint
    expect(html).toContain('name="maxWaitWindowMinutes"')
    expect(html).toContain('id="space-maxWaitWindowMinutes"')
    expect(html).toContain('aria-describedby="space-maxWaitWindowMinutes-hint"')

    // All 8 options from 15 min to 2 hr
    expect(html).toContain('value="15"')
    expect(html).toContain('15 min')
    expect(html).toContain('value="30"')
    expect(html).toContain('30 min')
    expect(html).toContain('value="45"')
    expect(html).toContain('45 min')
    expect(html).toContain('value="60"')
    expect(html).toContain('1 hr')
    expect(html).toContain('value="75"')
    expect(html).toContain('1 hr 15 min')
    expect(html).toContain('value="90"')
    expect(html).toContain('1 hr 30 min')
    expect(html).toContain('value="105"')
    expect(html).toContain('1 hr 45 min')
    expect(html).toContain('value="120"')
    expect(html).toContain('2 hr')

    // Default selected option is 60 minutes
    expect(html).toMatch(/<option[^>]*value="60"[^>]*selected[^>]*>1 hr<\/option>/)
  })

  it('renders edit mode with initial wait window preselected', () => {
    const html = renderToStaticMarkup(
      <SpaceForm
        mode="edit"
        action={dummyAction}
        spaceId="e0000000-0000-4000-8000-000000000001"
        initialValues={{
          name: 'Kapihan Study Hall',
          address: '123 Cebu St',
          opensAt: '08:00',
          closesAt: '22:00',
          maxWaitWindowMinutes: '45',
        }}
      />,
    )

    expect(html).toContain('value="e0000000-0000-4000-8000-000000000001"')
    expect(html).toContain('value="Kapihan Study Hall"')
    expect(html).toMatch(/<option[^>]*value="45"[^>]*selected[^>]*>45 min<\/option>/)
  })
})
