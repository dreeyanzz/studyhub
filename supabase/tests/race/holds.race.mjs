// STORY-09, TSK-09.2: Concurrent race test for hold_unit.
// Design: docs/design/STORY-09-reserve-now-holds.md §4 (Row 2).
// Proves FR-2.5 (N3) and N2 using direct PostgreSQL connections.

import postgres from 'postgres'
import assert from 'node:assert/strict'

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const admin = postgres(databaseUrl, { max: 2 })
const sqlA = postgres(databaseUrl, { max: 1 })
const sqlB = postgres(databaseUrl, { max: 1 })

const SEEKER_1 = 'c0000000-0000-4000-8000-000000000001'
const SEEKER_2 = 'c0000000-0000-4000-8000-000000000002'

// Sulok Co-working units (open 24h)
const UNIT_U1 = 'f0000000-0000-4000-8000-000000000017'
const UNIT_U2 = 'f0000000-0000-4000-8000-000000000018'
const UNIT_U3 = 'f0000000-0000-4000-8000-000000000019'

// Deletes the two Seekers' reservations on U1 to U3 (their payments cascade), so each run
// starts with the units free and leaves no rows behind on the local stack.
async function cleanup() {
  await admin`
    delete from public.reservations
    where unit_id in (${UNIT_U1}, ${UNIT_U2}, ${UNIT_U3})
      and seeker_id in (${SEEKER_1}, ${SEEKER_2})
  `
}

async function runCase1() {
  console.log('# Case 1: Two Seekers hold the same unit at the same moment (FR-2.5, N3)')
  await cleanup()

  let allowACommit
  const allowACommitPromise = new Promise((resolve) => {
    allowACommit = resolve
  })

  let aAcquiredLock
  const aAcquiredLockPromise = new Promise((resolve) => {
    aAcquiredLock = resolve
  })

  // Connection A starts tx, sets Seeker 1 identity, calls hold_unit, then holds before commit
  const txAPromise = sqlA.begin(async (txA) => {
    await txA.unsafe('set local role authenticated')
    await txA`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: SEEKER_1,
      role: 'authenticated',
    })}, true)`

    const res = await txA`select * from public.hold_unit(${UNIT_U1}, 30)`
    aAcquiredLock()
    await allowACommitPromise
    return res
  })

  // Wait until A has called hold_unit and acquired the lock
  await aAcquiredLockPromise

  // Connection B starts tx, sets Seeker 2 identity, attempts to call hold_unit on same unit
  let bFinished = false
  let bError = null
  let bResult = null

  const txBPromise = sqlB
    .begin(async (txB) => {
      await txB.unsafe('set local role authenticated')
      await txB`select set_config('request.jwt.claims', ${JSON.stringify({
        sub: SEEKER_2,
        role: 'authenticated',
      })}, true)`

      return await txB`select * from public.hold_unit(${UNIT_U1}, 30)`
    })
    .then((res) => {
      bFinished = true
      bResult = res
    })
    .catch((err) => {
      bFinished = true
      bError = err
    })

  // Verify via pg_stat_activity that B's query is waiting on the lock held by A
  let bWaitingOnLock = false
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((r) => setTimeout(r, 50))
    if (bFinished) {
      break
    }
    const waitingQueries = await admin`
      select pid, wait_event_type, wait_event, state
      from pg_stat_activity
      where wait_event_type = 'Lock'
        and query like '%hold_unit%'
    `
    if (waitingQueries.length > 0) {
      bWaitingOnLock = true
      break
    }
  }

  assert.equal(
    bWaitingOnLock,
    true,
    'Connection B must be waiting on the unit lock in pg_stat_activity',
  )
  assert.equal(
    bFinished,
    false,
    'Connection B must remain blocked while A holds the lock',
  )
  console.log('ok 1 - Connection B waited on unit lock in pg_stat_activity')

  // Now allow Connection A to commit
  allowACommit()
  const resA = await txAPromise
  assert.equal(resA.length, 1)
  assert.equal(resA[0].status, 'pending_payment')
  assert.equal(resA[0].created, true)
  console.log('ok 2 - Connection A got the hold')

  // Now wait for Connection B to finish
  await txBPromise
  assert.ok(bError, 'Connection B must have failed with an error')
  const bHint = bError.hint || bError.message
  assert.ok(
    bHint.includes('unit_not_available'),
    `Connection B must get unit_not_available refusal, got: ${bError.message} (hint: ${bError.hint})`,
  )
  console.log('ok 3 - Connection B was refused with unit_not_available')

  // Verify database state: exactly one active hold on UNIT_U1
  const holds = await admin`
    select id, seeker_id, status
    from public.reservations
    where unit_id = ${UNIT_U1}
      and status in ('pending_payment', 'reserved', 'occupied')
  `
  assert.equal(holds.length, 1, 'Exactly one active hold must exist on the unit')
  assert.equal(holds[0].seeker_id, SEEKER_1, 'The active hold must belong to Seeker A')
  console.log('ok 4 - Exactly one hold exists for the unit')
}

async function runCase2() {
  console.log('# Case 2: One Seeker holds two units at the same moment (N2)')
  await cleanup()

  let allowACommit
  const allowACommitPromise = new Promise((resolve) => {
    allowACommit = resolve
  })

  let aAcquiredHold
  const aAcquiredHoldPromise = new Promise((resolve) => {
    aAcquiredHold = resolve
  })

  // Connection A holds U2 for Seeker 1 inside a transaction but does not commit yet
  const txAPromise = sqlA.begin(async (txA) => {
    await txA.unsafe('set local role authenticated')
    await txA`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: SEEKER_1,
      role: 'authenticated',
    })}, true)`

    const res = await txA`select * from public.hold_unit(${UNIT_U2}, 30)`
    aAcquiredHold()
    await allowACommitPromise
    return res
  })

  await aAcquiredHoldPromise

  // Connection B tries to hold U3 for the same Seeker 1
  let bError = null
  let bResult = null

  const txBPromise = sqlB
    .begin(async (txB) => {
      await txB.unsafe('set local role authenticated')
      await txB`select set_config('request.jwt.claims', ${JSON.stringify({
        sub: SEEKER_1,
        role: 'authenticated',
      })}, true)`

      return await txB`select * from public.hold_unit(${UNIT_U3}, 30)`
    })
    .then((res) => {
      bResult = res
    })
    .catch((err) => {
      bError = err
    })

  // Give B a brief moment to run into the unique index lock or query check
  await new Promise((r) => setTimeout(r, 100))

  // Allow A to commit
  allowACommit()
  const resA = await txAPromise
  await txBPromise

  // One must succeed, the other must fail with seeker_has_hold
  assert.equal(resA.length, 1)
  assert.equal(resA[0].status, 'pending_payment')
  assert.equal(resA[0].created, true)
  console.log('ok 5 - Exactly one concurrent hold succeeded')

  assert.ok(bError, 'The second hold must fail')
  const bHint = bError.hint || bError.message
  assert.ok(
    bHint.includes('seeker_has_hold'),
    `The second hold must be refused with seeker_has_hold, got: ${bError.message} (hint: ${bError.hint})`,
  )
  console.log('ok 6 - The other hold was refused with seeker_has_hold')

  // Verify database state: exactly one active hold for Seeker 1
  const seekerHolds = await admin`
    select id, unit_id, status
    from public.reservations
    where seeker_id = ${SEEKER_1}
      and status in ('pending_payment', 'reserved', 'occupied')
  `
  assert.equal(seekerHolds.length, 1, 'Exactly one active hold must exist for Seeker 1')
  assert.equal(seekerHolds[0].unit_id, UNIT_U2, 'The hold must be on unit U2')
  console.log('ok 7 - Exactly one active hold exists for the Seeker')
}

async function main() {
  let exitCode = 0
  try {
    await runCase1()
    await runCase2()
    await cleanup()
    console.log('# All race tests passed successfully.')
  } catch (err) {
    console.error('Race test failed:', err)
    await cleanup().catch(() => {})
    exitCode = 1
  } finally {
    await Promise.all([admin.end(), sqlA.end(), sqlB.end()])
    process.exit(exitCode)
  }
}

main()
