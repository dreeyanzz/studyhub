import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { identityFieldsChanged, SpaceForm } from './space-form'

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

  it('renders the price tier as a named radio group, defaulting to Budget (STORY-08)', () => {
    const html = renderToStaticMarkup(<SpaceForm mode="create" action={dummyAction} />)

    expect(html).toContain('>Price tier</legend>')
    expect(html).toContain('tabindex="-1"')
    expect(html.match(/name="priceTier"/g)).toHaveLength(4)
    for (const label of ['Free', 'Budget', 'Standard', 'Premium']) {
      expect(html).toContain(`/>${label}</label>`)
    }
    expect(html).toMatch(/<input[^>]*name="priceTier"[^>]*checked=""[^>]*value="budget"/)
  })

  it('renders empty, optional latitude and longitude fields on create (STORY-08)', () => {
    const html = renderToStaticMarkup(<SpaceForm mode="create" action={dummyAction} />)

    expect(html).toContain('>Map pin</legend>')
    expect(html).toMatch(
      /<input[^>]*id="space-latitude"[^>]*name="latitude"[^>]*value=""/,
    )
    expect(html).toMatch(
      /<input[^>]*id="space-longitude"[^>]*name="longitude"[^>]*value=""/,
    )
    expect(html).toContain('inputMode="decimal"')
  })

  it('fills the saved pin and price tier in edit mode (STORY-08)', () => {
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
          latitude: '10.3157',
          longitude: '123.8854',
          priceTier: 'premium',
        }}
      />,
    )

    expect(html).toContain('value="10.3157"')
    expect(html).toContain('value="123.8854"')
    expect(html).toMatch(/<input[^>]*name="priceTier"[^>]*checked=""[^>]*value="premium"/)
    expect(html).not.toMatch(/checked=""[^>]*value="budget"/)
  })
})

describe('identityFieldsChanged: what sends a Verified Space back to Pending (STORY-20, V4, V6)', () => {
  const saved = {
    name: 'Kapihan Study Hall',
    address: '12 Mabini St',
    description: 'Quiet',
    opensAt: '08:00',
    closesAt: '22:00',
    latitude: '10.3157',
    longitude: '123.8854',
  }
  const same = {
    name: 'Kapihan Study Hall',
    address: '12 Mabini St',
    latitude: 10.3157,
    longitude: 123.8854,
  }

  it('is false when the name, address and pin are unchanged (V4)', () => {
    expect(identityFieldsChanged(saved, same)).toBe(false)
  })

  it('compares as the database stores: trimmed text, and the pin as numbers', () => {
    expect(identityFieldsChanged({ ...saved, name: '  Kapihan Study Hall ' }, same)).toBe(
      false,
    )
    expect(identityFieldsChanged({ ...saved, latitude: '10.31570' }, same)).toBe(false)
  })

  it('is true when the name, the address or either coordinate changes (V6)', () => {
    expect(identityFieldsChanged(saved, { ...same, name: 'Kapihan Annex' })).toBe(true)
    expect(identityFieldsChanged(saved, { ...same, address: '14 Mabini St' })).toBe(true)
    expect(identityFieldsChanged(saved, { ...same, latitude: 10.3158 })).toBe(true)
    expect(identityFieldsChanged(saved, { ...same, longitude: 123.8855 })).toBe(true)
  })

  it('counts adding or removing a pin as a change (D-084)', () => {
    const noPin = { ...saved, latitude: '', longitude: '' }
    expect(identityFieldsChanged(noPin, same)).toBe(true)
    expect(
      identityFieldsChanged(saved, {
        ...same,
        latitude: undefined,
        longitude: undefined,
      }),
    ).toBe(true)
    expect(
      identityFieldsChanged(noPin, {
        ...same,
        latitude: undefined,
        longitude: undefined,
      }),
    ).toBe(false)
  })
})

describe('SpaceForm on a Verified Space (STORY-20, V6)', () => {
  const dummyAction = vi.fn(async () => ({}))
  const initialValues = { name: 'Kapihan Study Hall', address: '12 Mabini St' }

  it('keeps the warning closed until a save needs it', () => {
    const html = renderToStaticMarkup(
      <SpaceForm
        mode="edit"
        action={dummyAction}
        spaceId="e0000000-0000-4000-8000-000000000001"
        spaceStatus="verified"
        initialValues={initialValues}
      />,
    )
    expect(html).toContain('Save changes')
    expect(html).not.toContain('Send Space back to Pending verification?')
  })
})
