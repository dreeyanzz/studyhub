// STORY-10: Concurrent race tests for public.check_in (TSK-10.1).
// Design: docs/design/STORY-10-check-in-release.md §4.
// Proves serialization of simultaneous check-in scans (C3, C-N2) and check_in vs cancel_hold (C4)
// using direct PostgreSQL connections.

import postgres from 'postgres'
import assert from 'node:assert/strict'

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const admin = postgres(databaseUrl, { max: 2 })
const sqlA = postgres(databaseUrl, { max: 1 })
const sqlB = postgres(databaseUrl, { max: 1 })

const HOST_2 = 'b0000000-0000-4000-8000-000000000002'
const SEEKER_1 = 'c0000000-0000-4000-8000-000000000001'
const SEEKER_2 = 'c0000000-0000-4000-8000-000000000002'

// Sulok Co-working Space & units (open 24h)
const SPACE_3 = 'e0000000-0000-4000-8000-000000000003'
const UNIT_U1 = 'f0000000-0000-4000-8000-000000000017'
const UNIT_U2 = 'f0000000-0000-4000-8000-000000000018'
const UNIT_U3 = 'f0000000-0000-4000-8000-000000000019'

async function cleanup() {
  await admin`
    delete from public.reservations
    where unit_id in (${UNIT_U1}, ${UNIT_U2}, ${UNIT_U3})
      and seeker_id in (${SEEKER_1}, ${SEEKER_2})
  `
}

async function createReservedHold(unitId, seekerId, suffix) {
  let reservationId
  await admin.begin(async (tx) => {
    await tx.unsafe('set local role authenticated')
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: seekerId,
      role: 'authenticated',
    })}, true)`

    const held = await tx`select * from public.hold_unit(${unitId}, 30)`
    reservationId = held[0].reservation_id

    await tx`select public.attach_checkout_session(
      ${reservationId},
      ${'cs_race_' + suffix},
      ${'https://paymongo.test/checkout/cs_race_' + suffix}
    )`

    await tx.unsafe('reset role')
    await tx`select public.confirm_payment(
      ${reservationId},
      ${'cs_race_' + suffix},
      ${'pi_race_' + suffix}
    )`
  })

  const [row] = await admin`
    select booking_token
    from public.reservations
    where id = ${reservationId}
  `
  return { reservationId, token: row.booking_token }
}

async function runCase1() {
  console.log(
    '# Case 1: Two concurrent check_in calls on the same reserved token (C3, C-N2)',
  )
  await cleanup()

  const { reservationId, token } = await createReservedHold(
    UNIT_U1,
    SEEKER_1,
    'checkin_1',
  )

  let allowACommit
  const allowACommitPromise = new Promise((resolve) => {
    allowACommit = resolve
  })

  let aAcquiredLock
  const aAcquiredLockPromise = new Promise((resolve) => {
    aAcquiredLock = resolve
  })

  const txAPromise = sqlA.begin(async (txA) => {
    await txA.unsafe('set local role authenticated')
    await txA`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: HOST_2,
      role: 'authenticated',
    })}, true)`

    const res = await txA`select public.check_in(${token}, ${SPACE_3}) as result`
    aAcquiredLock()
    await allowACommitPromise
    return res[0].result
  })

  await aAcquiredLockPromise

  let bFinished = false
  let bError = null

  const txBPromise = sqlB
    .begin(async (txB) => {
      await txB.unsafe('set local role authenticated')
      await txB`select set_config('request.jwt.claims', ${JSON.stringify({
        sub: HOST_2,
        role: 'authenticated',
      })}, true)`

      return await txB`select public.check_in(${token}, ${SPACE_3}) as result`
    })
    .then(() => {
      bFinished = true
    })
    .catch((err) => {
      bFinished = true
      bError = err
    })

  let bWaitingOnLock = false
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((r) => setTimeout(r, 50))
    if (bFinished) {
      break
    }
    const waitingQueries = await admin`
      select pid, wait_event_type, wait_event
      from pg_stat_activity
      where wait_event_type = 'Lock'
        and query like '%check_in%'
    `
    if (waitingQueries.length > 0) {
      bWaitingOnLock = true
      break
    }
  }

  assert.equal(
    bWaitingOnLock,
    true,
    'Connection B must wait on unit/reservation lock in pg_stat_activity',
  )
  assert.equal(bFinished, false, 'Connection B must stay blocked while A holds the lock')
  console.log('ok 1 - Connection B waited on lock while Connection A held check_in open')

  allowACommit()
  const resA = await txAPromise
  assert.equal(resA.outcome, 'success')
  console.log('ok 2 - Connection A checked in the Seeker')

  await txBPromise
  assert.ok(bError, 'Connection B must fail after Connection A commits')
  const bHint = bError.hint || bError.message
  assert.ok(
    bHint.includes('token_already_used'),
    `Connection B must receive token_already_used, got: ${bError.message} (hint: ${bError.hint})`,
  )
  console.log('ok 3 - Connection B was refused with token_already_used')

  const [resRow] = await admin`
    select status, checked_in_at
    from public.reservations
    where id = ${reservationId}
  `
  assert.equal(resRow.status, 'occupied')
  assert.ok(resRow.checked_in_at, 'checked_in_at must be populated')
  console.log('ok 4 - Reservation row is occupied with checked_in_at set')
}

async function runCase2() {
  console.log('# Case 2: Concurrent check_in vs cancel_hold serialize in both directions')
  await cleanup()

  // Direction A: check_in acquires lock first -> cancel_hold wakes up and gets checked_in
  const hold1 = await createReservedHold(UNIT_U2, SEEKER_1, 'checkin_2a')

  let allowCheckInCommit
  const allowCheckInCommitPromise = new Promise((resolve) => {
    allowCheckInCommit = resolve
  })
  let checkInLocked
  const checkInLockedPromise = new Promise((resolve) => {
    checkInLocked = resolve
  })

  const txCheckInPromise = sqlA.begin(async (txA) => {
    await txA.unsafe('set local role authenticated')
    await txA`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: HOST_2,
      role: 'authenticated',
    })}, true)`
    const res = await txA`select public.check_in(${hold1.token}, ${SPACE_3}) as result`
    checkInLocked()
    await allowCheckInCommitPromise
    return res[0].result
  })

  await checkInLockedPromise

  let cancelFinished = false
  let cancelError = null
  const txCancelPromise = sqlB
    .begin(async (txB) => {
      await txB.unsafe('set local role authenticated')
      await txB`select set_config('request.jwt.claims', ${JSON.stringify({
        sub: SEEKER_1,
        role: 'authenticated',
      })}, true)`
      return await txB`select public.cancel_hold(${hold1.reservationId}, 'reserved')`
    })
    .then(() => {
      cancelFinished = true
    })
    .catch((err) => {
      cancelFinished = true
      cancelError = err
    })

  let cancelWaiting = false
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((r) => setTimeout(r, 50))
    if (cancelFinished) {
      break
    }
    const waitingQueries = await admin`
      select pid from pg_stat_activity
      where wait_event_type = 'Lock'
        and query like '%cancel_hold%'
    `
    if (waitingQueries.length > 0) {
      cancelWaiting = true
      break
    }
  }

  assert.equal(cancelWaiting, true, 'cancel_hold must wait on unit lock held by check_in')
  allowCheckInCommit()
  const checkInRes = await txCheckInPromise
  assert.equal(checkInRes.outcome, 'success')
  await txCancelPromise
  assert.ok(cancelError, 'cancel_hold must be refused once check_in commits')
  assert.ok(
    (cancelError.hint || cancelError.message).includes('checked_in'),
    `Expected checked_in refusal, got: ${cancelError.message} (hint: ${cancelError.hint})`,
  )
  console.log('ok 5 - check_in wins -> concurrent cancel_hold refused with checked_in')

  // Direction B: cancel_hold acquires lock first -> check_in wakes up and gets reservation_cancelled
  await cleanup()
  const hold2 = await createReservedHold(UNIT_U3, SEEKER_2, 'checkin_2b')

  let allowCancelCommit
  const allowCancelCommitPromise = new Promise((resolve) => {
    allowCancelCommit = resolve
  })
  let cancelLocked
  const cancelLockedPromise = new Promise((resolve) => {
    cancelLocked = resolve
  })

  const txCancelFirstPromise = sqlA.begin(async (txA) => {
    await txA.unsafe('set local role authenticated')
    await txA`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: SEEKER_2,
      role: 'authenticated',
    })}, true)`
    await txA`select public.cancel_hold(${hold2.reservationId}, 'reserved')`
    cancelLocked()
    await allowCancelCommitPromise
  })

  await cancelLockedPromise

  let checkInAfterCancelFinished = false
  let checkInAfterCancelError = null
  const txCheckInSecondPromise = sqlB
    .begin(async (txB) => {
      await txB.unsafe('set local role authenticated')
      await txB`select set_config('request.jwt.claims', ${JSON.stringify({
        sub: HOST_2,
        role: 'authenticated',
      })}, true)`
      return await txB`select public.check_in(${hold2.token}, ${SPACE_3}) as result`
    })
    .then(() => {
      checkInAfterCancelFinished = true
    })
    .catch((err) => {
      checkInAfterCancelFinished = true
      checkInAfterCancelError = err
    })

  let checkInWaiting = false
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((r) => setTimeout(r, 50))
    if (checkInAfterCancelFinished) {
      break
    }
    const waitingQueries = await admin`
      select pid from pg_stat_activity
      where wait_event_type = 'Lock'
        and query like '%check_in%'
    `
    if (waitingQueries.length > 0) {
      checkInWaiting = true
      break
    }
  }

  assert.equal(
    checkInWaiting,
    true,
    'check_in must wait on unit lock held by cancel_hold',
  )
  allowCancelCommit()
  await txCancelFirstPromise
  await txCheckInSecondPromise
  assert.ok(checkInAfterCancelError, 'check_in must fail after cancel_hold commits')
  assert.ok(
    (checkInAfterCancelError.hint || checkInAfterCancelError.message).includes(
      'reservation_cancelled',
    ),
    `Expected reservation_cancelled, got: ${checkInAfterCancelError.message} (hint: ${checkInAfterCancelError.hint})`,
  )
  console.log(
    'ok 6 - cancel_hold wins -> concurrent check_in refused with reservation_cancelled',
  )
}

async function main() {
  try {
    await runCase1()
    await runCase2()
    console.log('# All STORY-10 check-in concurrency tests passed')
  } finally {
    await cleanup()
    await admin.end()
    await sqlA.end()
    await sqlB.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
