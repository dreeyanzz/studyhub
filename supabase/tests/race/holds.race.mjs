// STORY-09: Concurrent race tests for hold_unit (TSK-09.2) and confirm_payment (TSK-09.3).
// Design: docs/design/STORY-09-reserve-now-holds.md §4 (Rows 2 and 3).
// Proves FR-2.5 (N3), N2, and the payment flow's W6, W10, W11 and W18, using direct
// PostgreSQL connections.

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

// ---------------------------------------------------------------------------
// TSK-09.3: confirm_payment races (payment confirmation flow §1.2, Cases B and C)
// ---------------------------------------------------------------------------

const SECRET_KEY = { role: 'service_role' }
const asSeeker = (id) => ({ sub: id, role: 'authenticated' })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Acts as a role for the rest of the transaction, as PostgREST would.
async function actAs(tx, claims) {
  await tx.unsafe(`set local role ${claims.role}`)
  await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`
}

// Seeker holds the unit for 30 minutes, committed, and gets the reservation's id.
async function holdAs(seekerId, unitId) {
  const [hold] = await admin.begin(async (tx) => {
    await actAs(tx, asSeeker(seekerId))
    return tx`select reservation_id from public.hold_unit(${unitId}, 30)`
  })
  return hold.reservation_id
}

// Runs work in a transaction on sql and keeps it open, with its locks, until release().
// claims null runs it as postgres.
function openTransaction(sql, claims, work) {
  let release
  const released = new Promise((resolve) => {
    release = resolve
  })
  let markStarted
  const started = new Promise((resolve) => {
    markStarted = resolve
  })
  const done = sql
    .begin(async (tx) => {
      if (claims) await actAs(tx, claims)
      const result = await work(tx)
      markStarted()
      await released
      return result
    })
    .finally(() => markStarted())
  return { started, release, done }
}

// Runs work in a transaction on sql, and records how it ended without throwing.
function runTransaction(sql, claims, work) {
  const state = { finished: false, result: null, error: null }
  state.done = sql
    .begin(async (tx) => {
      await actAs(tx, claims)
      return work(tx)
    })
    .then(
      (result) => {
        state.finished = true
        state.result = result
      },
      (error) => {
        state.finished = true
        state.error = error
      },
    )
  return state
}

// True once pg_stat_activity shows a call to fnName waiting on a lock.
async function waitsOnLock(fnName, state) {
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(50)
    if (state.finished) return false
    const waiting = await admin`
      select pid
      from pg_stat_activity
      where wait_event_type = 'Lock'
        and query like ${`%${fnName}%`}
    `
    if (waiting.length > 0) return true
  }
  return false
}

async function reservationState(reservationId) {
  const [row] = await admin`
    select r.status, r.booking_token, p.status as payment_status, p.external_payment_id
    from public.reservations r
    join public.payments p on p.reservation_id = r.id
    where r.id = ${reservationId}
  `
  return row
}

const confirmPayment = (reservationId, n) => (tx) =>
  tx`select public.confirm_payment(${reservationId}, ${`cs_test_race_${n}`}, ${`pay_test_race_${n}`}) as result`

const cancelUnpaidHold = (reservationId) => (tx) =>
  tx`select public.cancel_hold(${reservationId}, 'pending_payment')`

async function runCase3() {
  console.log('# Case 3: Two webhook deliveries for one payment at the same moment (W6)')
  await cleanup()
  const reservationId = await holdAs(SEEKER_1, UNIT_U1)

  const first = openTransaction(sqlA, SECRET_KEY, confirmPayment(reservationId, 3))
  await first.started
  const second = runTransaction(sqlB, SECRET_KEY, confirmPayment(reservationId, 3))

  assert.equal(
    await waitsOnLock('confirm_payment', second),
    true,
    'The second delivery must wait on the lock the first one holds',
  )
  console.log('ok 8 - The second delivery waited on the lock the first one held')

  first.release()
  const [firstRow] = await first.done
  await second.done
  assert.ifError(second.error)
  assert.equal(firstRow.result.outcome, 'confirmed')
  assert.deepEqual(second.result[0].result, {
    outcome: 'already_processed',
    reservation_status: 'reserved',
    payment_status: 'paid',
  })
  console.log(
    'ok 9 - The first delivery confirmed the payment, and the second changed nothing',
  )

  const state = await reservationState(reservationId)
  assert.equal(state.status, 'reserved')
  assert.equal(state.payment_status, 'paid')
  assert.match(state.booking_token, /^[0-9A-HJKMNP-TV-Z]{12}$/)
  const [tokens] = await admin`
    select count(*)::int as n from public.reservations where booking_token = ${state.booking_token}
  `
  assert.equal(tokens.n, 1, 'Exactly one reservation must have the booking token')
  console.log('ok 10 - The unit is Reserved, with exactly one booking token')
}

async function runCase4() {
  console.log('# Case 4: A cancel and a confirmation at the same moment (W10, W11)')

  // The Seeker's cancel commits first (W10)
  await cleanup()
  let reservationId = await holdAs(SEEKER_1, UNIT_U1)

  let cancel = openTransaction(sqlA, asSeeker(SEEKER_1), cancelUnpaidHold(reservationId))
  await cancel.started
  let confirm = runTransaction(sqlB, SECRET_KEY, confirmPayment(reservationId, 4))

  assert.equal(
    await waitsOnLock('confirm_payment', confirm),
    true,
    'The confirmation must wait on the lock the cancel holds',
  )
  console.log('ok 11 - The confirmation waited on the lock the cancel held')

  cancel.release()
  await cancel.done
  await confirm.done
  assert.ifError(confirm.error)
  assert.deepEqual(confirm.result[0].result, {
    outcome: 'late_payment',
    reservation_status: 'cancelled',
    payment_status: 'paid',
  })
  let state = await reservationState(reservationId)
  assert.equal(state.status, 'cancelled')
  assert.equal(state.payment_status, 'paid')
  assert.equal(state.booking_token, null)
  console.log(
    'ok 12 - With the cancel first, the hold stays cancelled and the payment is late',
  )

  // The confirmation commits first (W11)
  await cleanup()
  reservationId = await holdAs(SEEKER_1, UNIT_U1)

  confirm = openTransaction(sqlA, SECRET_KEY, confirmPayment(reservationId, 5))
  await confirm.started
  cancel = runTransaction(sqlB, asSeeker(SEEKER_1), cancelUnpaidHold(reservationId))

  assert.equal(
    await waitsOnLock('cancel_hold', cancel),
    true,
    'The cancel must wait on the lock the confirmation holds',
  )
  console.log('ok 13 - The cancel waited on the lock the confirmation held')

  confirm.release()
  const [confirmRow] = await confirm.done
  await cancel.done
  assert.equal(confirmRow.result.outcome, 'confirmed')
  assert.ok(cancel.error, 'The cancel must be refused')
  assert.equal(
    cancel.error.hint,
    'hold_changed',
    `The cancel must be refused with hold_changed, got: ${cancel.error.message}`,
  )
  state = await reservationState(reservationId)
  assert.equal(state.status, 'reserved')
  assert.equal(state.payment_status, 'paid')
  console.log(
    'ok 14 - With the confirmation first, the cancel is refused with hold_changed',
  )
}

async function runCase5() {
  console.log(
    '# Case 5: The payment window ends while the webhook waits for the unit (W18)',
  )
  await cleanup()
  const reservationId = await holdAs(SEEKER_1, UNIT_U1)

  // The payment window now ends 3 seconds from now.
  await admin`
    update public.reservations
    set payment_window_ends_at = clock_timestamp() + interval '3 seconds'
    where id = ${reservationId}
  `

  // Something else holds the unit's lock, as a Host's tap does inside set_unit_state.
  const unitLock = openTransaction(
    sqlA,
    null,
    (tx) => tx`select id from public.units where id = ${UNIT_U1} for update`,
  )
  await unitLock.started
  const confirm = runTransaction(sqlB, SECRET_KEY, confirmPayment(reservationId, 6))

  assert.equal(
    await waitsOnLock('confirm_payment', confirm),
    true,
    'The webhook must wait on the lock on the unit',
  )
  const [paymentWindow] = await admin`
    select payment_window_ends_at > clock_timestamp() as open
    from public.reservations
    where id = ${reservationId}
  `
  assert.equal(
    paymentWindow.open,
    true,
    'The webhook must start waiting before the payment window ends',
  )
  console.log(
    'ok 15 - The webhook waited on the unit while the payment window was still open',
  )

  // Let the payment window end, then free the unit.
  let passed = false
  for (let attempt = 0; attempt < 50 && !passed; attempt++) {
    await sleep(100)
    const [row] = await admin`
      select payment_window_ends_at <= clock_timestamp() as passed
      from public.reservations
      where id = ${reservationId}
    `
    passed = row.passed
  }
  assert.equal(passed, true, 'The payment window must have ended')
  unitLock.release()
  await unitLock.done
  await confirm.done

  assert.ifError(confirm.error)
  assert.deepEqual(confirm.result[0].result, {
    outcome: 'late_payment',
    reservation_status: 'expired',
    payment_status: 'paid',
  })
  const state = await reservationState(reservationId)
  assert.equal(state.status, 'expired')
  assert.equal(state.payment_status, 'paid')
  assert.equal(state.booking_token, null)
  console.log(
    'ok 16 - The webhook recorded the lapse once it had the unit, so the late payment did not reserve',
  )
}

async function main() {
  let exitCode = 0
  try {
    await runCase1()
    await runCase2()
    await runCase3()
    await runCase4()
    await runCase5()
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
