import { expect, test, type Browser, type Page } from '@playwright/test'
import postgres from 'postgres'

/**
 * The Host setup journey (docs/flows/host-setup-journey.md, #177), walked as its
 * "Paths and test coverage" table names it. Each test's title starts with the path IDs it
 * proves. Runs against the local stack and CI only (D-013, D-028).
 */

// The shared seed password for all local test accounts (supabase/seed.sql).
const SEED_PASSWORD = 'Worq-demo-2026'

const databaseUrl =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// host@example.test (supabase/seed.sql), who sets up every Space in this file.
const HOST_ID = 'b0000000-0000-4000-8000-000000000001'
const NAME_PREFIX = 'Journey Space'

// A 1x1 PNG, for the photo upload.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function db() {
  return postgres(databaseUrl, { max: 1 })
}

/** Deletes every Space this file made, and their photos' Storage rows. */
async function deleteJourneySpaces() {
  const sql = db()
  try {
    const spaces = await sql<{ id: string }[]>`
      select id from public.spaces
      where host_id = ${HOST_ID} and name like ${NAME_PREFIX + ' %'}
    `
    for (const { id } of spaces) {
      await sql.begin(async (tx) => {
        await tx.unsafe('set local storage.allow_delete_query = true')
        await tx`delete from storage.objects where bucket_id = 'space-photos' and name like ${id + '/%'}`
      })
    }
    await sql`delete from public.spaces where host_id = ${HOST_ID} and name like ${NAME_PREFIX + ' %'}`
  } finally {
    await sql.end()
  }
}

async function findSpace(name: string) {
  const sql = db()
  try {
    const [row] = await sql<{ id: string; status: string }[]>`
      select id, status from public.spaces where name = ${name}
    `
    return row
  } finally {
    await sql.end()
  }
}

async function requireSpace(name: string) {
  const row = await findSpace(name)
  if (!row) throw new Error(`No Space named ${name}`)
  return row
}

async function curatedTagId(label: string) {
  const sql = db()
  try {
    const [row] = await sql<
      { id: string }[]
    >`select id from public.curated_tags where label = ${label}`
    if (!row) throw new Error(`No curated tag labelled ${label}`)
    return row.id
  } finally {
    await sql.end()
  }
}

async function signIn(page: Page, email: string, returnUrl: string) {
  await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(returnUrl)
}

async function newPage(browser: Browser, email?: string, returnUrl = '/') {
  const page = await (await browser.newContext()).newPage()
  if (email) await signIn(page, email, returnUrl)
  return page
}

function uniqueName(label: string) {
  return `${NAME_PREFIX} ${label} ${Date.now()}`
}

/** Creates a Space through the Host's form, with a map pin, and returns its id. */
async function createSpace(host: Page, name: string) {
  await host.goto('/host')
  await host.getByLabel('Space name').fill(name)
  await host.getByLabel('Address').fill('12 Journey St, Cebu City')
  await host.getByLabel('Opening time').fill('00:00')
  await host.getByLabel('Closing time').fill('00:00')
  await host.getByLabel('Latitude').fill('10.3540')
  await host.getByLabel('Longitude').fill('123.9114')
  await host.getByRole('button', { name: 'Create Space' }).click()
  await expect(host.getByText('Space created. It is pending verification.')).toBeVisible()
  return (await requireSpace(name)).id
}

function hostCard(host: Page, name: string) {
  return host.locator('[data-slot="card"]').filter({
    has: host.getByRole('heading', { level: 3, name }),
  })
}

function adminCard(admin: Page, name: string) {
  return admin.locator('[data-slot="card"]').filter({
    has: admin.getByRole('heading', { level: 2, name }),
  })
}

/** V2, from the Pending list. */
async function approveSpace(admin: Page, name: string) {
  await admin.goto('/admin')
  await adminCard(admin, name)
    .getByRole('button', { name: `Approve ${name}` })
    .click()
  await expect(admin.getByRole('status')).toContainText(`${name} has been approved.`)
}

/** V3, from the Pending list, with the reason N10 requires. */
async function rejectSpace(admin: Page, name: string, reason: string) {
  await admin.goto('/admin')
  await adminCard(admin, name)
    .getByRole('button', { name: `Reject ${name}` })
    .click()
  const dialog = admin.getByRole('dialog', { name: `Reject Space - ${name}` })
  await dialog.getByLabel('Reason').fill(reason)
  await dialog.getByRole('button', { name: 'Confirm rejection' }).click()
  await expect(admin.getByRole('status')).toContainText(`${name} has been rejected.`)
}

/** V7, from the Verified list, with the reason N10 requires. */
async function takeDownSpace(admin: Page, name: string, reason: string) {
  await admin.goto('/admin?tab=verified')
  await adminCard(admin, name)
    .getByRole('button', { name: `Take down ${name}` })
    .click()
  const dialog = admin.getByRole('dialog', { name: `Take down Space - ${name}` })
  await dialog.getByLabel('Reason').fill(reason)
  await dialog.getByRole('button', { name: 'Take down Space' }).click()
  await expect(admin.getByRole('status')).toContainText(`${name} has been taken down.`)
  await expect(dialog).toBeHidden()
}

/** Search results and the public profile, as a signed-out visitor sees them. */
async function expectFoundBySeekers(page: Page, id: string, name: string) {
  await page.goto(`/spaces?q=${encodeURIComponent(name)}`)
  await expect(page.getByText(name).first()).toBeVisible()
  await page.goto(`/spaces/${id}`)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** Search results and the public profile, as a signed-out visitor or a Seeker sees them. */
async function expectHiddenFromSeekers(page: Page, id: string, name: string) {
  await page.goto(`/spaces?q=${encodeURIComponent(name)}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText(name)).toHaveCount(0)
  await page.goto(`/spaces/${id}`)
  await expect(page.getByText('This page could not be found.')).toBeVisible()
}

test.describe('Host setup journey (docs/flows/host-setup-journey.md)', () => {
  test.beforeAll(deleteJourneySpaces)
  test.afterAll(deleteJourneySpaces)

  test('host-open-portal, host-space-create-invalid, host-space-created-pending: a Host opens the portal, fixes invalid details, and creates a Pending Space', async ({
    page,
  }) => {
    await signIn(page, 'host@example.test', '/host')
    await expect(page.getByLabel('Space name')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Space' })).toBeVisible()

    const name = uniqueName('Created')
    await page.getByLabel('Space name').fill(name)
    await page.getByLabel('Address').fill('12 Journey St, Cebu City')
    await page.getByLabel('Opening time').fill('08:00')
    await page.getByLabel('Closing time').fill('20:00')
    await page.getByLabel('Latitude').fill('95')
    await page.getByRole('button', { name: 'Create Space' }).click()

    await expect(page.getByText('Latitude must be between -90 and 90')).toBeVisible()
    await expect(page.getByLabel('Space name')).toHaveValue(name)
    await expect(page.getByLabel('Address')).toHaveValue('12 Journey St, Cebu City')
    expect(await findSpace(name)).toBeUndefined()

    await page.getByLabel('Latitude').fill('10.3540')
    await page.getByLabel('Longitude').fill('123.9114')
    await page.getByRole('button', { name: 'Create Space' }).click()

    await expect(
      page.getByText('Space created. It is pending verification.'),
    ).toBeVisible()
    await expect(hostCard(page, name).getByText('Pending verification')).toBeVisible()
    expect((await requireSpace(name)).status).toBe('pending')
  })

  test('host-space-enters-admin-queue, host-pending-space-hidden, host-sees-pending: a new Space waits in the Administrator queue before it has units, hidden from Seekers, while its Host keeps setting it up', async ({
    page,
    browser,
  }) => {
    await signIn(page, 'host@example.test', '/host')
    const name = uniqueName('Queued')
    const id = await createSpace(page, name)

    const admin = await newPage(browser, 'admin@example.test', '/admin')
    await expect(admin.getByRole('heading', { level: 2, name })).toBeVisible()
    await expect(
      adminCard(admin, name).getByRole('button', { name: `Approve ${name}` }),
    ).toBeVisible()

    await expectHiddenFromSeekers(await newPage(browser), id, name)
    await expectHiddenFromSeekers(
      await newPage(browser, 'seeker@example.test', '/seeker'),
      id,
      name,
    )

    await page.goto('/host')
    await expect(hostCard(page, name).getByText('Pending verification')).toBeVisible()
    await hostCard(page, name)
      .getByRole('link', { name: `Seat map for ${name}` })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: 'Seat map' })).toBeVisible()
    await expect(page.getByText('Pending verification')).toBeVisible()
  })

  test('host-setup-seat-map: zones and units saved on the seat map are in the keyboard-accessible list', async ({
    page,
  }) => {
    await signIn(page, 'host@example.test', '/host')
    const name = uniqueName('Seat map')
    const id = await createSpace(page, name)

    await page.goto(`/host/spaces/${id}/seat-map`)
    await page.getByLabel('New zone name').fill('Quiet desks')
    await page.getByRole('button', { name: 'Add zone' }).click()

    await page.goto(`/host/spaces/${id}/seat-map?view=list`)
    const zone = page.getByRole('region', { name: 'Quiet desks' })
    await expect(zone).toBeVisible()

    const addUnit = async (row: string, col: string, label: string, type: string) => {
      const form = zone
        .locator('form')
        .filter({ has: page.getByRole('button', { name: 'Add unit' }) })
      // Once a zone has a unit, its add form folds into "Add a unit to <zone>".
      if (!(await form.getByLabel('Row').isVisible())) {
        await zone.getByText('Add a unit to Quiet desks', { exact: true }).click()
      }
      await form.getByLabel('Row').selectOption({ label: row })
      await form.getByLabel('Column').selectOption({ label: col })
      await form.getByLabel('Label').fill(label)
      await form.getByLabel('Type').selectOption({ label: type })
      return form
    }
    const unitCard = (label: string) => zone.getByRole('article', { name: label })

    // A seat, by keyboard alone: the list view offers the map's actions (D-031).
    const seatForm = await addUnit('Row 1', 'Column 1', 'J1', 'Seat')
    await seatForm.getByLabel('Label').focus()
    await page.keyboard.press('Enter')
    await expect(unitCard('J1')).toContainText('Seat · Row 1, Column 1')

    await (
      await addUnit('Row 1', 'Column 2', 'J2', 'Standing desk')
    )
      .getByRole('button', { name: 'Add unit' })
      .click()
    await expect(unitCard('J2')).toContainText('Standing desk · Row 1, Column 2')

    const roomForm = await addUnit('Row 2', 'Column 1', 'J3', 'Whole room')
    await roomForm.getByLabel('Capacity (people)').fill('6')
    await roomForm.getByRole('button', { name: 'Add unit' }).click()
    await expect(unitCard('J3')).toContainText(
      'Whole room · Capacity: 6 people · Row 2, Columns 1 to 2',
    )

    const sql = db()
    try {
      const units = await sql<
        { label: string; unit_type: string; capacity: number | null }[]
      >`
        select u.label, u.unit_type, u.capacity
        from public.units u join public.zones z on z.id = u.zone_id
        where z.space_id = ${id} order by u.label
      `
      expect(units).toEqual([
        { label: 'J1', unit_type: 'seat', capacity: null },
        { label: 'J2', unit_type: 'standing_desk', capacity: null },
        { label: 'J3', unit_type: 'room', capacity: 6 },
      ])
    } finally {
      await sql.end()
    }

    // They are still in the list after a reload: saved, not just shown.
    await page.reload()
    for (const label of ['J1', 'J2', 'J3']) await expect(unitCard(label)).toBeVisible()
    expect((await requireSpace(name)).status).toBe('pending')
  })

  test('host-setup-tags, host-setup-photos, host-edit-preserves-status, host-admin-approves-space, host-sees-verified, host-checks-status: a Host tags, photographs and edits a Pending Space; once an Administrator approves it, the Host sees Verified after refreshing and Seekers find it', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000)
    await signIn(page, 'host@example.test', '/host')
    const name = uniqueName('Approved')
    const id = await createSpace(page, name)

    // Tags: one curated tag, which Seekers filter by, and one custom display tag.
    await page.goto(`/host/spaces/${id}/tags`)
    await page.getByRole('checkbox', { name: /^Wi-Fi: Fast \(50\+ Mbps\)/ }).check()
    await page.getByLabel('Add a custom tag').fill('Journey corner')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('button', { name: 'Save tags' }).click()
    await expect(page.getByRole('status').filter({ hasText: /saved/i })).toBeVisible()

    // A photo, while the Space is Pending. The app makes the signed upload URL and calls
    // Storage as usual; the test answers that one upload itself and records the object's
    // row, because the local stack's Storage rejects every upload (42P10, a version
    // mismatch in its own schema). The list and the public profile then read the row.
    await page.route(
      '**/storage/v1/object/upload/sign/space-photos/**',
      async (route) => {
        const path = decodeURIComponent(
          new URL(route.request().url()).pathname.split(
            '/object/upload/sign/space-photos/',
          )[1] ?? '',
        )
        const sql = db()
        try {
          await sql`
          insert into storage.objects (bucket_id, name, owner_id, metadata)
          values ('space-photos', ${path}, ${HOST_ID}, ${sql.json({ size: PNG.length, mimetype: 'image/png' })})
        `
        } finally {
          await sql.end()
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Key: `space-photos/${path}` }),
        })
      },
    )
    await page.goto(`/host/spaces/${id}/photos`)
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'journey.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByText('Success', { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    await page.reload()
    await expect(page.getByText(/Uploaded Photos \(1\)/)).toBeVisible()

    // An edit keeps Pending (D-027).
    await page.goto(`/host/spaces/${id}/edit`)
    await page.getByLabel('Description').fill('Quiet tables by the window.')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await page.goto('/host')
    await expect(hostCard(page, name).getByText('Pending verification')).toBeVisible()
    expect((await requireSpace(name)).status).toBe('pending')

    // V2: the Administrator approves it.
    const admin = await newPage(browser, 'admin@example.test', '/admin')
    await adminCard(admin, name)
      .getByRole('button', { name: `Approve ${name}` })
      .click()
    await expect(admin.getByRole('status')).toContainText(`${name} has been approved.`)

    // The Host refreshes the list and sees Verified.
    await page.reload()
    await expect(
      hostCard(page, name).getByText('Verified', { exact: true }),
    ).toBeVisible()

    // A Seeker finds it, filters by its curated tag but not its custom tag, and opens it.
    const seeker = await newPage(browser)
    await seeker.goto(`/spaces?q=${encodeURIComponent(name)}`)
    await expect(seeker.getByText(name).first()).toBeVisible()
    const fast = await curatedTagId('Wi-Fi: Fast (50+ Mbps)')
    const ultra = await curatedTagId('Wi-Fi: Ultra-Fast (100+ Mbps)')
    await seeker.goto(`/spaces?q=${encodeURIComponent(name)}&tags=${fast}`)
    await expect(seeker.getByText(name).first()).toBeVisible()
    await seeker.goto(`/spaces?q=${encodeURIComponent(name)}&tags=${ultra}`)
    await expect(seeker.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(seeker.getByText(name)).toHaveCount(0)
    await expect(seeker.getByRole('checkbox', { name: /Journey corner/ })).toHaveCount(0)

    await seeker.goto(`/spaces/${id}`)
    await expect(seeker.getByRole('heading', { level: 1, name })).toBeVisible()
    await expect(seeker.getByText('Journey corner')).toBeVisible()
    // next/image URL-encodes the path, so match on the Space id alone.
    await expect(seeker.locator(`img[src*="${id}"]`).first()).toBeAttached()

    // Editing a Verified Space keeps it Verified (D-027).
    await page.goto(`/host/spaces/${id}/edit`)
    await page.getByLabel('Description').fill('Quiet tables by the window, and a garden.')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await page.goto('/host')
    await expect(
      hostCard(page, name).getByText('Verified', { exact: true }),
    ).toBeVisible()
    expect((await requireSpace(name)).status).toBe('verified')
  })

  test('host-admin-rejects-space, host-sees-rejected: an Administrator rejects a Space with a reason; its Host sees the reason, and Seekers still cannot find it', async ({
    page,
    browser,
  }) => {
    await signIn(page, 'host@example.test', '/host')
    const name = uniqueName('Rejected')
    const id = await createSpace(page, name)

    const admin = await newPage(browser, 'admin@example.test', '/admin')
    await adminCard(admin, name)
      .getByRole('button', { name: `Reject ${name}` })
      .click()
    // A rejection needs a reason (STORY-20, N10).
    const reasonDialog = admin.getByRole('dialog', { name: `Reject Space — ${name}` })
    await reasonDialog.getByLabel('Reason').fill('The photos show a different building.')
    await reasonDialog.getByRole('button', { name: 'Confirm rejection' }).click()
    await expect(admin.getByRole('status')).toContainText(`${name} has been rejected.`)
    await expect(reasonDialog).toBeHidden()

    await page.reload()
    const card = hostCard(page, name)
    await expect(card.getByText('Rejected', { exact: true })).toBeVisible()
    // STORY-20 TSK-20.2 (D-084): the Host reads the reason and can resubmit.
    // TSK-20.4 covers resubmitting (host-resubmits-space).
    await expect(card.getByText('Rejection reason:')).toBeVisible()
    await expect(card.getByText('The photos show a different building.')).toBeVisible()
    await expect(card.getByRole('button', { name: `Resubmit ${name}` })).toBeVisible()
    expect((await requireSpace(name)).status).toBe('rejected')

    await expectHiddenFromSeekers(await newPage(browser), id, name)
  })

  test('host-edit-returns-pending: a Host renames a Verified Space after a warning, and it waits in the queue marked Edited, hidden from Seekers', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000)
    await signIn(page, 'host@example.test', '/host')
    const name = uniqueName('Edited')
    const renamed = `${name} renamed`
    const id = await createSpace(page, name)
    const admin = await newPage(browser, 'admin@example.test', '/admin')
    await approveSpace(admin, name)
    const seeker = await newPage(browser)
    await expectFoundBySeekers(seeker, id, name)

    // V6: changing the name of a Verified Space asks first.
    await page.goto(`/host/spaces/${id}/edit`)
    await page.getByLabel('Space name').fill(renamed)
    await page.getByRole('button', { name: 'Save changes' }).click()
    const warning = page.getByRole('alertdialog', {
      name: 'Send Space back to Pending verification?',
    })
    await expect(warning).toBeVisible()
    await warning.getByRole('button', { name: 'Save and send for review' }).click()
    await expect(
      page.getByText(
        'Space changes saved. It is back to Pending verification until an Administrator reviews it.',
      ),
    ).toBeVisible()
    await expect(hostCard(page, renamed).getByText('Pending verification')).toBeVisible()
    expect((await requireSpace(renamed)).status).toBe('pending')

    // It waits in the Pending list, marked Edited, with the rename in its list of changes.
    await admin.goto('/admin')
    const card = adminCard(admin, renamed)
    await expect(card.getByText('Edited', { exact: true })).toBeVisible()
    await expect(card.getByRole('region', { name: 'List of changes' })).toContainText(
      `Name: ${name}`,
    )
    await expect(card.getByRole('button', { name: `Approve ${renamed}` })).toBeVisible()

    await expectHiddenFromSeekers(seeker, id, renamed)
  })

  test('host-resubmits-space: a Host resubmits a Rejected Space, and it waits in the queue marked Resubmitted, with its reason', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000)
    await signIn(page, 'host@example.test', '/host')
    const name = uniqueName('Resubmitted')
    const reason = 'The opening hours do not match the sign.'
    const id = await createSpace(page, name)
    const admin = await newPage(browser, 'admin@example.test', '/admin')
    await rejectSpace(admin, name, reason)

    // V8: the Host resubmits it from their list.
    await page.goto('/host')
    await hostCard(page, name)
      .getByRole('button', { name: `Resubmit ${name}` })
      .click()
    await expect(page.getByText('Space resubmitted for verification.')).toBeVisible()
    const card = hostCard(page, name)
    await expect(card.getByText('Pending verification')).toBeVisible()
    await expect(card.getByText('Previous reason:')).toBeVisible()
    await expect(card.getByText(reason)).toBeVisible()
    await expect(card.getByRole('button', { name: `Resubmit ${name}` })).toHaveCount(0)
    expect((await requireSpace(name)).status).toBe('pending')

    // The Administrator sees it back in the Pending list, marked Resubmitted.
    await admin.goto('/admin')
    const queued = adminCard(admin, name)
    await expect(queued.getByText('Resubmitted', { exact: true })).toBeVisible()
    await expect(queued.getByText('Previous reason:')).toBeVisible()
    await expect(queued.getByText(reason).first()).toBeVisible()
    await expect(queued.getByRole('button', { name: `Approve ${name}` })).toBeVisible()

    await expectHiddenFromSeekers(await newPage(browser), id, name)
  })

  test('host-admin-takes-down-space: an Administrator takes a Verified Space down; Seekers can no longer find it, and its Host sees the reason', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000)
    await signIn(page, 'host@example.test', '/host')
    const name = uniqueName('Taken down')
    const reason = 'The Space has closed for repairs.'
    const id = await createSpace(page, name)
    const admin = await newPage(browser, 'admin@example.test', '/admin')
    await approveSpace(admin, name)
    const seeker = await newPage(browser)
    await expectFoundBySeekers(seeker, id, name)

    // V7, with a reason.
    await takeDownSpace(admin, name, reason)
    expect((await requireSpace(name)).status).toBe('taken_down')
    await admin.goto('/admin?tab=taken_down')
    const listed = adminCard(admin, name)
    await expect(listed.getByText('Taken down', { exact: true })).toBeVisible()
    await expect(listed.getByText(reason).first()).toBeVisible()

    await expectHiddenFromSeekers(seeker, id, name)

    await page.goto('/host')
    const card = hostCard(page, name)
    await expect(card.getByText('Taken down', { exact: true })).toBeVisible()
    await expect(card.getByText('Take-down reason:')).toBeVisible()
    await expect(card.getByText(reason)).toBeVisible()
    await expect(card.getByRole('button', { name: `Resubmit ${name}` })).toBeVisible()
  })

  test('host-admin-restores-space: an Administrator puts a Taken down Space back, and Seekers find it again', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000)
    await signIn(page, 'host@example.test', '/host')
    const name = uniqueName('Restored')
    const id = await createSpace(page, name)
    const admin = await newPage(browser, 'admin@example.test', '/admin')
    await approveSpace(admin, name)
    await takeDownSpace(admin, name, 'A Seeker reported the wrong address.')
    const seeker = await newPage(browser)
    await expectHiddenFromSeekers(seeker, id, name)

    // V10: put it back, after a confirmation.
    await admin.goto('/admin?tab=taken_down')
    await adminCard(admin, name)
      .getByRole('button', { name: `Put back ${name}` })
      .click()
    const confirm = admin.getByRole('alertdialog', { name: 'Put Space back?' })
    await confirm.getByRole('button', { name: 'Put back', exact: true }).click()
    await expect(admin.getByRole('status')).toContainText(
      `${name} has been put back and is now Verified.`,
    )
    await expect(confirm).toBeHidden()
    expect((await requireSpace(name)).status).toBe('verified')

    await expectFoundBySeekers(seeker, id, name)

    // Its Host sees Verified, with no reason left on the card (N12).
    await page.goto('/host')
    const card = hostCard(page, name)
    await expect(card.getByText('Verified', { exact: true })).toBeVisible()
    await expect(card.getByText('Take-down reason:')).toHaveCount(0)
  })
})
