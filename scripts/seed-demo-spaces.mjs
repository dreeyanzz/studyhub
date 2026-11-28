// Seeds the 50 real Metro Cebu study/co-working spaces, 15 synthetic @example.test
// users, zones, units, tags, cover photos, space_events, reservations, payments,
// reviews, review reports, and moderation events into either cloud dev (.env.local)
// or local Docker Supabase (--local) for full local + cloud parity (D-097).
//
// Usage:
//   npm run db:seed:demo -- --reset         # cloud dev (.env.local)
//   npm run db:seed:demo:local -- --reset   # local Docker Supabase
//
// Pass --dry-run to validate configuration without writing anything.

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  buildDemoCatalog,
  DEMO_PHOTO_FILES,
  DEMO_SCENARIOS,
  demoUuid,
} from './data/cebu-demo-spaces.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PHOTOS_DIR = path.join(__dirname, 'assets', 'demo-photos')
const PHOTO_BUCKET = 'space-photos'
const FEE_AMOUNT = 5000 // ₱50.00 in centavos (matches private.reservation_settings)
const LOCAL_SEED_PASSWORD = 'Worq-demo-2026'

const args = new Set(process.argv.slice(2))
const isLocal = args.has('--local')
const shouldReset = args.has('--reset')
const isDryRun = args.has('--dry-run')

function fail(message) {
  console.error(`Error: ${message}`)
  process.exitCode = 1
  throw new Error(message)
}

function resolveTargetConfig() {
  if (isLocal) {
    let url = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321'
    let secretKey = process.env.LOCAL_SUPABASE_SECRET_KEY || ''
    if (!secretKey) {
      try {
        const raw = execSync('npx supabase status -o json', {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        const status = JSON.parse(raw)
        url = status.API_URL || url
        secretKey = status.SERVICE_ROLE_KEY || status.SECRET_KEY || ''
      } catch {
        fail(
          'Could not read local Supabase status. Start local Supabase with `npm run db:start` first.',
        )
      }
    }
    if (!secretKey) {
      fail('Local Supabase service role / secret key not found.')
    }
    return {
      label: 'local Supabase',
      url,
      secretKey,
      accountPassword: LOCAL_SEED_PASSWORD,
      adminPassword: LOCAL_SEED_PASSWORD,
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const accountPassword = process.env.CLOUD_DEV_ACCOUNT_PASSWORD
  const adminPassword = process.env.CLOUD_DEV_ADMIN_PASSWORD

  if (!url || !secretKey) {
    fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local.')
  }
  if (!accountPassword || !adminPassword) {
    fail(
      'CLOUD_DEV_ACCOUNT_PASSWORD and CLOUD_DEV_ADMIN_PASSWORD must be set in .env.local.',
    )
  }

  return {
    label: `cloud (${new URL(url).host})`,
    url,
    secretKey,
    accountPassword,
    adminPassword,
  }
}

function minutesAgoIso(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

function daysAgoIso(days, extraMinutes = 0) {
  return new Date(Date.now() - (days * 1440 + extraMinutes) * 60_000).toISOString()
}

function minutesFromNowIso(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

async function emptySpacePhotos(supabase, spaceIds) {
  let removed = 0
  for (const spaceId of spaceIds) {
    const { data: files, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .list(spaceId, { limit: 100 })
    if (error || !files || files.length === 0) continue
    const paths = files.map((f) => `${spaceId}/${f.name}`)
    const { error: rmError } = await supabase.storage.from(PHOTO_BUCKET).remove(paths)
    if (rmError) {
      console.warn(
        `  Warning: could not remove photos for ${spaceId}: ${rmError.message}`,
      )
    } else {
      removed += paths.length
    }
  }
  return removed
}

async function ensureDemoUsers(supabase, users, accountPassword, adminPassword) {
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) fail(`Failed to list auth users: ${listError.message}`)

  const byEmail = new Map(
    (listed?.users || []).map((u) => [String(u.email || '').toLowerCase(), u]),
  )
  const userIdsByKey = new Map()
  let created = 0
  let reused = 0

  // Create missing auth users in parallel batches of 5 to keep seeding fast
  const BATCH_SIZE = 5
  const profileRows = []
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (spec) => {
        const emailKey = spec.email.toLowerCase()
        const password = spec.isAdminPassword ? adminPassword : accountPassword
        let existing = byEmail.get(emailKey)

        if (!existing) {
          const { data: createdData, error: createError } =
            await supabase.auth.admin.createUser({
              email: spec.email,
              password,
              email_confirm: true,
              user_metadata: {
                role: spec.role === 'admin' ? 'seeker' : spec.role,
                full_name: spec.fullName,
              },
            })
          if (createError || !createdData?.user) {
            fail(`Failed to create user ${spec.email}: ${createError?.message}`)
          }
          existing = createdData.user
          created++
        } else {
          reused++
        }

        userIdsByKey.set(spec.key, existing.id)
        profileRows.push({
          id: existing.id,
          role: spec.role,
          full_name: spec.fullName,
          phone_number: spec.phoneNumber,
          role_confirmed: spec.roleConfirmed,
        })
      }),
    )
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profileRows, { onConflict: 'id' })
  if (profileError) {
    fail(`Failed to upsert demo profiles: ${profileError.message}`)
  }

  return { userIdsByKey, created, reused }
}

async function run() {
  const config = resolveTargetConfig()
  const catalog = buildDemoCatalog()

  console.log(`Target: ${config.label}`)
  console.log(
    `Catalog: ${catalog.spaces.length} spaces, ${catalog.users.length} synthetic users`,
  )

  // Preload photo buffers from disk
  const photoBuffers = new Map()
  for (const filename of DEMO_PHOTO_FILES) {
    photoBuffers.set(filename, readFileSync(path.join(PHOTOS_DIR, filename)))
  }

  if (isDryRun) {
    console.log('Dry run succeeded — no database or storage writes performed.')
    return
  }

  const supabase = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Ensure all 15 synthetic demo users exist and have exact profile states
  const { userIdsByKey, created, reused } = await ensureDemoUsers(
    supabase,
    catalog.users,
    config.accountPassword,
    config.adminPassword,
  )
  console.log(`Users ready: ${created} created, ${reused} existing updated.`)

  const adminId = userIdsByKey.get('admin')

  // 2. Optional full reset of spaces + storage photos (D-092: empty photos first)
  if (shouldReset) {
    const { data: existingSpaces, error: fetchErr } = await supabase
      .from('spaces')
      .select('id')
    if (fetchErr) fail(`Failed to fetch existing spaces: ${fetchErr.message}`)

    const existingIds = (existingSpaces || []).map((s) => s.id)
    if (existingIds.length > 0) {
      const removedPhotos = await emptySpacePhotos(supabase, existingIds)
      const { error: delErr } = await supabase
        .from('spaces')
        .delete()
        .in('id', existingIds)
      if (delErr) fail(`Failed to clear existing spaces: ${delErr.message}`)
      console.log(
        `Reset cleared ${existingIds.length} existing spaces and ${removedPhotos} storage photos.`,
      )
    }
  } else {
    // Even without --reset, delete previous demo-catalog spaces so re-running is idempotent
    const demoIds = catalog.spaces.map((s) => s.id)
    await emptySpacePhotos(supabase, demoIds)
    await supabase.from('spaces').delete().in('id', demoIds)
  }

  // 3. Insert 50 spaces
  const spaceRows = catalog.spaces.map((s) => ({
    id: s.id,
    host_id: userIdsByKey.get(s.hostKey),
    name: s.name,
    description: s.description,
    address: s.address,
    opens_at: s.opensAt,
    closes_at: s.closesAt,
    latitude: s.latitude,
    longitude: s.longitude,
    price_tier: s.priceTier,
    max_wait_window: `${s.maxWaitWindowMinutes} minutes`,
    status: s.status,
    status_reason: s.statusReason ?? null,
    status_changed_by: s.status === 'pending' ? null : adminId,
    status_changed_at: minutesAgoIso(s.freshnessMinutesAgo + 60),
  }))

  const { error: spacesErr } = await supabase.from('spaces').insert(spaceRows)
  if (spacesErr) fail(`Failed to insert spaces: ${spacesErr.message}`)
  console.log(`Inserted ${spaceRows.length} Metro Cebu spaces.`)

  // 4. Insert zones & units
  const zoneRows = []
  const unitRows = []
  const unitBySpaceAndLabel = new Map()

  for (const s of catalog.spaces) {
    const updatedIso = minutesAgoIso(s.freshnessMinutesAgo)
    for (const z of s.zones) {
      zoneRows.push({
        id: z.id,
        space_id: z.spaceId,
        name: z.name,
        position: z.position,
      })
      for (const u of z.units) {
        unitRows.push({
          id: u.id,
          space_id: u.spaceId,
          zone_id: u.zoneId,
          unit_type: u.unitType,
          label: u.label,
          capacity: u.capacity,
          grid_row: u.gridRow,
          grid_col: u.gridCol,
          col_span: u.colSpan,
          host_state: u.hostState,
          host_updated_at: updatedIso,
        })
        unitBySpaceAndLabel.set(`${s.index}:${u.label}`, u)
      }
    }
  }

  if (zoneRows.length > 0) {
    const { error: zonesErr } = await supabase.from('zones').insert(zoneRows)
    if (zonesErr) fail(`Failed to insert zones: ${zonesErr.message}`)
  }
  if (unitRows.length > 0) {
    const { error: unitsErr } = await supabase.from('units').insert(unitRows)
    if (unitsErr) fail(`Failed to insert units: ${unitsErr.message}`)
  }
  console.log(`Inserted ${zoneRows.length} zones and ${unitRows.length} units.`)

  // 5. Insert curated & custom tags
  const curatedRows = []
  const customRows = []
  for (const s of catalog.spaces) {
    for (const tagId of s.curatedTags) {
      curatedRows.push({ space_id: s.id, tag_id: tagId })
    }
    for (const tagName of s.customTags) {
      customRows.push({ space_id: s.id, name: tagName })
    }
  }
  if (curatedRows.length > 0) {
    const { error: ctErr } = await supabase.from('space_curated_tags').insert(curatedRows)
    if (ctErr) fail(`Failed to insert space_curated_tags: ${ctErr.message}`)
  }
  if (customRows.length > 0) {
    const { error: custErr } = await supabase.from('space_custom_tags').insert(customRows)
    if (custErr) fail(`Failed to insert space_custom_tags: ${custErr.message}`)
  }
  console.log(
    `Inserted ${curatedRows.length} curated tag links and ${customRows.length} custom tags.`,
  )

  // 6. Insert space_events (verification approvals, identity re-verification, rejections, take-downs)
  let spaceEventSeq = 1
  const spaceEventRows = []
  for (const s of catalog.spaces) {
    if (s.reverifyIdentityEdit) {
      spaceEventRows.push({
        id: demoUuid('58000000', spaceEventSeq++),
        space_id: s.id,
        actor_id: adminId,
        from_status: 'pending',
        to_status: 'verified',
        created_at: daysAgoIso(14),
      })
      spaceEventRows.push({
        id: demoUuid('58000000', spaceEventSeq++),
        space_id: s.id,
        actor_id: userIdsByKey.get(s.hostKey),
        from_status: 'verified',
        to_status: 'pending',
        old_name: s.reverifyIdentityEdit.oldName,
        new_name: s.name,
        old_address: s.reverifyIdentityEdit.oldAddress,
        new_address: s.address,
        old_latitude: s.reverifyIdentityEdit.oldLatitude,
        new_latitude: s.latitude,
        old_longitude: s.reverifyIdentityEdit.oldLongitude,
        new_longitude: s.longitude,
        created_at: minutesAgoIso(s.freshnessMinutesAgo),
      })
    } else if (s.status === 'rejected') {
      spaceEventRows.push({
        id: demoUuid('58000000', spaceEventSeq++),
        space_id: s.id,
        actor_id: adminId,
        from_status: 'pending',
        to_status: 'rejected',
        reason: s.statusReason,
        created_at: minutesAgoIso(s.freshnessMinutesAgo),
      })
    } else if (s.status === 'taken_down') {
      spaceEventRows.push({
        id: demoUuid('58000000', spaceEventSeq++),
        space_id: s.id,
        actor_id: adminId,
        from_status: 'pending',
        to_status: 'verified',
        created_at: daysAgoIso(20),
      })
      spaceEventRows.push({
        id: demoUuid('58000000', spaceEventSeq++),
        space_id: s.id,
        actor_id: adminId,
        from_status: 'verified',
        to_status: 'taken_down',
        reason: s.statusReason,
        created_at: minutesAgoIso(s.freshnessMinutesAgo),
      })
    }
  }
  if (spaceEventRows.length > 0) {
    const { error: evErr } = await supabase.from('space_events').insert(spaceEventRows)
    if (evErr) fail(`Failed to insert space_events: ${evErr.message}`)
  }

  // 7. Upload cover photos to space-photos bucket
  let uploadedPhotos = 0
  for (const s of catalog.spaces) {
    for (let i = 0; i < s.photos.length; i++) {
      const filename = s.photos[i]
      const objectPath = `${s.id}/${String(i + 1).padStart(2, '0')}-${filename}`
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(objectPath, photoBuffers.get(filename), {
          contentType: 'image/jpeg',
          upsert: true,
        })
      if (upErr) {
        fail(`Failed to upload photo ${objectPath}: ${upErr.message}`)
      }
      uploadedPhotos++
    }
  }
  console.log(`Uploaded ${uploadedPhotos} photos to ${PHOTO_BUCKET} bucket.`)

  // 8. Insert reservations, payments, reviews, reports, and moderation events
  const reservationRows = []
  const paymentRows = []
  const reviewRows = []
  const editedReviews = []
  const reportRows = []
  const modEventRows = []

  let reportSeq = 1
  let modSeq = 1

  // 8a. Active holds
  for (const h of DEMO_SCENARIOS.activeHolds) {
    const resId = demoUuid('53000000', h.index)
    const payId = demoUuid('54000000', h.index)
    const unit = unitBySpaceAndLabel.get(`${h.spaceIndex}:${h.unitLabel}`)
    if (!unit) fail(`Missing unit ${h.spaceIndex}:${h.unitLabel} for active hold`)

    const isPendingPayment = h.status === 'pending_payment'
    reservationRows.push({
      id: resId,
      seeker_id: userIdsByKey.get(h.seekerKey),
      space_id: demoUuid('50000000', h.spaceIndex),
      unit_id: unit.id,
      unit_label: unit.label,
      status: h.status,
      cancelled_by_take_down: false,
      wait_window: `${h.waitWindowMinutes} minutes`,
      payment_window_ends_at: isPendingPayment ? minutesFromNowIso(9) : minutesAgoIso(10),
      wait_window_ends_at: isPendingPayment
        ? null
        : minutesFromNowIso(h.waitWindowMinutes - 10),
      booking_token: h.bookingToken,
      checked_in_at: h.status === 'occupied' ? minutesAgoIso(5) : null,
      checked_out_at: null,
      ended_at: null,
      created_at: minutesAgoIso(15),
    })

    paymentRows.push({
      id: payId,
      reservation_id: resId,
      status: h.paymentStatus,
      fee_amount: FEE_AMOUNT,
      checkout_session_id: `cs_demo_${h.index}`,
      external_payment_id: isPendingPayment ? null : `pi_demo_${h.index}`,
      paid_at: isPendingPayment ? null : minutesAgoIso(12),
      created_at: minutesAgoIso(15),
    })
  }

  // 8b. Historical non-completed reservations
  for (const h of DEMO_SCENARIOS.historicalNonCompleted) {
    const resId = demoUuid('53000000', h.index)
    const payId = demoUuid('54000000', h.index)
    const unit = unitBySpaceAndLabel.get(`${h.spaceIndex}:${h.unitLabel}`)
    if (!unit) fail(`Missing unit ${h.spaceIndex}:${h.unitLabel} for historical hold`)

    const isPendingPay = h.paymentStatus === 'pending'
    const isRefunded = h.paymentStatus === 'refunded'

    reservationRows.push({
      id: resId,
      seeker_id: userIdsByKey.get(h.seekerKey),
      space_id: demoUuid('50000000', h.spaceIndex),
      unit_id: unit.id,
      unit_label: unit.label,
      status: h.status,
      cancelled_by_take_down: Boolean(h.cancelledByTakeDown),
      wait_window: `${h.waitWindowMinutes} minutes`,
      payment_window_ends_at: daysAgoIso(h.daysAgo, 50),
      wait_window_ends_at: isPendingPay ? null : daysAgoIso(h.daysAgo, 10),
      booking_token: h.bookingToken,
      checked_in_at: null,
      checked_out_at: null,
      ended_at: daysAgoIso(h.daysAgo),
      created_at: daysAgoIso(h.daysAgo, 60),
    })

    paymentRows.push({
      id: payId,
      reservation_id: resId,
      status: h.paymentStatus,
      fee_amount: FEE_AMOUNT,
      checkout_session_id: `cs_demo_${h.index}`,
      external_payment_id: isPendingPay ? null : `pi_demo_${h.index}`,
      paid_at: isPendingPay ? null : daysAgoIso(h.daysAgo, 55),
      refund_id: isRefunded ? `re_demo_${h.index}` : null,
      refund_reason: isRefunded ? h.refundReason : null,
      refunded_at: isRefunded ? daysAgoIso(h.daysAgo, -10) : null,
      refunded_by: isRefunded ? adminId : null,
      created_at: daysAgoIso(h.daysAgo, 60),
    })
  }

  // 8c. Completed visits + reviews + reports + moderation events
  for (const v of DEMO_SCENARIOS.completedVisitsWithReviews) {
    const resId = demoUuid('53000000', v.index)
    const payId = demoUuid('54000000', v.index)
    const unit = unitBySpaceAndLabel.get(`${v.spaceIndex}:${v.unitLabel}`)
    if (!unit) fail(`Missing unit ${v.spaceIndex}:${v.unitLabel} for completed visit`)

    const seekerId = userIdsByKey.get(v.seekerKey)
    const spaceId = demoUuid('50000000', v.spaceIndex)

    reservationRows.push({
      id: resId,
      seeker_id: seekerId,
      space_id: spaceId,
      unit_id: unit.id,
      unit_label: unit.label,
      status: 'completed',
      cancelled_by_take_down: false,
      wait_window: '60 minutes',
      payment_window_ends_at: daysAgoIso(v.daysAgo, 170),
      wait_window_ends_at: daysAgoIso(v.daysAgo, 115),
      booking_token: `WRQ2026${String(v.index).padStart(5, '0')}`,
      checked_in_at: daysAgoIso(v.daysAgo, 120),
      checked_out_at: daysAgoIso(v.daysAgo),
      ended_at: daysAgoIso(v.daysAgo),
      created_at: daysAgoIso(v.daysAgo, 180),
    })

    paymentRows.push({
      id: payId,
      reservation_id: resId,
      status: 'paid',
      fee_amount: FEE_AMOUNT,
      checkout_session_id: `cs_demo_${v.index}`,
      external_payment_id: `pi_demo_${v.index}`,
      paid_at: daysAgoIso(v.daysAgo, 175),
      created_at: daysAgoIso(v.daysAgo, 180),
    })

    if (v.review) {
      const revId = demoUuid('55000000', v.index)
      const isModerated = v.review.status !== 'visible'
      reviewRows.push({
        id: revId,
        reservation_id: resId,
        space_id: spaceId,
        author_id: seekerId,
        quietness: v.review.quietness,
        wifi_reliability: v.review.wifi,
        cleanliness: v.review.cleanliness,
        comfort: v.review.comfort,
        comment: v.review.edited ? 'Initial visit review.' : v.review.comment,
        status: v.review.status,
        status_changed_by: isModerated ? adminId : null,
        status_changed_at: isModerated ? daysAgoIso(v.daysAgo - 1) : null,
        created_at: daysAgoIso(v.daysAgo, -30),
      })

      if (v.review.edited) {
        editedReviews.push({ id: revId, comment: v.review.comment })
      }

      if (v.review.openReport) {
        reportRows.push({
          id: demoUuid('56000000', reportSeq++),
          review_id: revId,
          reporter_id: userIdsByKey.get(v.review.openReport.reporterKey),
          review_version: 1,
          reason: v.review.openReport.reason,
          note: v.review.openReport.note,
          created_at: minutesAgoIso(45),
        })
      }

      if (v.review.closedReport) {
        reportRows.push({
          id: demoUuid('56000000', reportSeq++),
          review_id: revId,
          reporter_id: userIdsByKey.get(v.review.closedReport.reporterKey),
          review_version: 1,
          reason: v.review.closedReport.reason,
          note: v.review.closedReport.note,
          outcome: v.review.closedReport.outcome,
          closed_by: adminId,
          closed_at: daysAgoIso(v.daysAgo - 1),
          created_at: daysAgoIso(v.daysAgo, -60),
        })
        modEventRows.push({
          id: demoUuid('57000000', modSeq++),
          review_id: revId,
          actor_id: adminId,
          action: v.review.closedReport.modAction,
          created_at: daysAgoIso(v.daysAgo - 1),
        })
      }
    }
  }

  const { error: resErr } = await supabase.from('reservations').insert(reservationRows)
  if (resErr) fail(`Failed to insert reservations: ${resErr.message}`)

  const { error: payErr } = await supabase.from('payments').insert(paymentRows)
  if (payErr) fail(`Failed to insert payments: ${payErr.message}`)

  const { error: revErr } = await supabase.from('reviews').insert(reviewRows)
  if (revErr) fail(`Failed to insert reviews: ${revErr.message}`)

  // Trigger bump_review_version() cleanly for edited reviews so version=2 & edited_at are set
  await Promise.all(
    editedReviews.map(async (edit) => {
      const { error: editErr } = await supabase
        .from('reviews')
        .update({ comment: edit.comment })
        .eq('id', edit.id)
      if (editErr) fail(`Failed to apply review edit: ${editErr.message}`)
    }),
  )

  if (reportRows.length > 0) {
    const { error: repErr } = await supabase.from('review_reports').insert(reportRows)
    if (repErr) fail(`Failed to insert review_reports: ${repErr.message}`)
  }

  if (modEventRows.length > 0) {
    const { error: modErr } = await supabase
      .from('review_moderation_events')
      .insert(modEventRows)
    if (modErr) fail(`Failed to insert review_moderation_events: ${modErr.message}`)
  }

  console.log(
    `Inserted ${reservationRows.length} reservations, ${paymentRows.length} payments, ${reviewRows.length} reviews, ${reportRows.length} review reports, ${modEventRows.length} moderation events, ${spaceEventRows.length} space events.`,
  )
  console.log('Done! Demo catalog seeded cleanly.')
}

await run().catch(() => {
  process.exitCode = 1
})
