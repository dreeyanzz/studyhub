-- STORY-10, TSK-10.1: Booking token check-in, check-out, complete lapse recording, and closing-time protection.
-- Tests docs/design/STORY-10-check-in-release.md §2 & §4, docs/flows/check-in.md, and
-- docs/flows/reservation-lifecycle.md (R5, R6, R7, H2, C1-C7, C-N1-C-N4, N8, N11, N18, N22, N25).
--
-- Seed accounts:
--   admin   a0000000-0000-4000-8000-000000000001
--   host    b0000000-0000-4000-8000-000000000001  owns e...01 (verified, units f...01..14)
--   host2   b0000000-0000-4000-8000-000000000002  owns e...03 (verified, 24h, units f...17..19)
--   seeker  c0000000-0000-4000-8000-000000000001
--   seeker2 c0000000-0000-4000-8000-000000000002

begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

-- Captures SQLSTATE and HINT for functions/triggers that distinguish refusals by hint (design §2).
create function pg_temp.refusal(p_sql text)
returns text
language plpgsql
as $$
declare
  v_code text;
  v_hint text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_code = returned_sqlstate, v_hint = pg_exception_hint;
  return v_code || ' ' || coalesce(nullif(v_hint, ''), '(no hint)');
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. private.last_closing_time (FR-2.8, D-048) & direct access checks
-- ---------------------------------------------------------------------------
select is(
  private.last_closing_time(null, '22:00'::time, '2026-11-14 15:00+08'::timestamptz),
  null::timestamptz,
  'last_closing_time returns null when opens_at is null'
);

select is(
  private.last_closing_time('00:00'::time, '00:00'::time, '2026-11-14 15:00+08'::timestamptz),
  null::timestamptz,
  'last_closing_time returns null for 24-hour spaces'
);

select is(
  private.last_closing_time('07:00'::time, '22:00'::time, '2026-11-14 21:59:00+08'::timestamptz),
  '2026-11-13 22:00:00+08'::timestamptz,
  'daytime space before today closing returns yesterday closing time'
);

select is(
  private.last_closing_time('07:00'::time, '22:00'::time, '2026-11-14 22:00:00+08'::timestamptz),
  '2026-11-14 22:00:00+08'::timestamptz,
  'daytime space at exact closing boundary returns today closing time'
);

select is(
  private.last_closing_time('18:00'::time, '02:00'::time, '2026-11-14 01:30:00+08'::timestamptz),
  '2026-11-13 02:00:00+08'::timestamptz,
  'overnight space before early-morning closing returns previous morning closing time'
);

select is(
  private.last_closing_time('18:00'::time, '02:00'::time, '2026-11-14 23:00:00+08'::timestamptz),
  '2026-11-14 02:00:00+08'::timestamptz,
  'overnight space in evening shift returns that morning closing time'
);

-- Seed deterministic reservations/payments as postgres
set local role postgres;

-- Keep Space e...01 open around clock_timestamp() for hours-agnostic check-in/out tests;
-- set e...01 back to fixed hours when testing closing-time lapses later.
update public.spaces
set opens_at = '00:00'::time,
    closes_at = '00:00'::time
where id = 'e0000000-0000-4000-8000-000000000001';

-- Seed: reserved hold r1 on Space e...01 (f...01) for seeker 1
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token
) values (
  '11000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001',
  'A1',
  'reserved',
  interval '60 minutes',
  clock_timestamp() - interval '5 minutes',
  clock_timestamp() + interval '55 minutes',
  'ABCD1234EFGH'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '21000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  'paid',
  5000,
  'pi_test_10_01',
  clock_timestamp() - interval '5 minutes'
);

-- Seed: reserved hold r2 on Space e...03 (f...17, owned by host2) for seeker 2
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token
) values (
  '11000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000003',
  'f0000000-0000-4000-8000-000000000017',
  'U1',
  'reserved',
  interval '60 minutes',
  clock_timestamp() - interval '5 minutes',
  clock_timestamp() + interval '55 minutes',
  'WXYZ9876KMNP'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '21000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000002',
  'paid',
  5000,
  'pi_test_10_02',
  clock_timestamp() - interval '5 minutes'
);

-- ---------------------------------------------------------------------------
-- 2. Grants & authorization boundaries (N8, N25, C-N1, C-N2)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select private.last_closing_time('07:00'::time, '22:00'::time, now())$$,
  '42501',
  null,
  'signed-out visitor cannot call private.last_closing_time'
);

select throws_ok(
  $$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'signed-out visitor cannot call check_in'
);

select throws_ok(
  $$select public.check_out('11000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'signed-out visitor cannot call check_out'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'unit_states hides wait_window_ends_at from signed-out visitors (N25)'
);

-- Seeker 1 cannot check in or read wait_window_ends_at in unit_states
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'a Seeker cannot call check_in'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'unit_states hides wait_window_ends_at from Seekers (N25)'
);

select is(
  pg_temp.refusal($$select public.check_out('11000000-0000-4000-8000-000000000001')$$),
  'P0001 not_checked_in',
  'check_out refuses a reserved hold that has not checked in (N11)'
);

-- Host 2 and Admin cannot check in at Host 1 space or read wait_window_ends_at
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'another Host cannot call check_in for a Space they do not own'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'unit_states hides wait_window_ends_at from another Host (N25)'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'an Administrator cannot call check_in for another Host Space'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'unit_states hides wait_window_ends_at from Administrators (N25)'
);

-- Host 1 sees wait_window_ends_at on reserved hold in unit_states
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select ok(
  (select wait_window_ends_at is not null
   from public.unit_states('e0000000-0000-4000-8000-000000000001')
   where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  'unit_states exposes wait_window_ends_at to the Space Host while reserved'
);

-- ---------------------------------------------------------------------------
-- 3. public.check_in token validation, wrong space, and check-in transition (C1-C3, C-N1, C-N2)
-- ---------------------------------------------------------------------------
select is(
  pg_temp.refusal($$select public.check_in('N9PE1234N9PE', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 invalid_token',
  'check_in refuses an unknown token with invalid_token (C-N1)'
);

select is(
  pg_temp.refusal($$select public.check_in(null, 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 invalid_token',
  'check_in refuses a null token with invalid_token (C-N1)'
);

select is(
  pg_temp.refusal($$select public.check_in('WXYZ9876KMNP', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 wrong_space',
  'check_in refuses a valid token from another Space with wrong_space (C-N2)'
);

select is(
  (select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001') ->> 'outcome'),
  'success',
  'check_in succeeds on an active reserved hold at the matching Space (C3)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  'occupied',
  'unit_states reflects occupied immediately after check_in'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'unit_states clears wait_window_ends_at for the Host once checked in'
);

-- Verify checked-in state as postgres and via Seeker my_reservation
set local role postgres;
select ok(
  (select status = 'occupied' and checked_in_at is not null and ended_at is null
   from public.reservations where id = '11000000-0000-4000-8000-000000000001'),
  'check_in sets status=occupied, checked_in_at non-null, and keeps ended_at null'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select ok(
  (select status = 'occupied' and booking_token is null and checked_in_at is not null
   from public.my_reservation()),
  'my_reservation returns checked_in_at and omits booking_token once occupied'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.set_unit_state('f0000000-0000-4000-8000-000000000001', 'available')$$),
  'P0001 hold_not_named',
  'Host tap without naming active occupied hold refuses with hold_not_named (N14, D-050)'
);

-- Re-scanning occupied reservation token refuses (C5)

select is(
  pg_temp.refusal($$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 token_already_used',
  'check_in refuses a token that is already occupied with token_already_used (C5)'
);

-- ---------------------------------------------------------------------------
-- 4. public.check_out authorization, release, and invalid states (R5, N8, N11)
-- ---------------------------------------------------------------------------
-- Other Seeker and Host cannot check out Seeker 1's occupied reservation (N8)
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.check_out('11000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'another Seeker cannot check out Seeker 1 occupied reservation (N8)'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.check_out('11000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'a Host cannot check out a Seeker reservation (N8)'
);

-- Seeker 1 checks out of occupied reservation r1 (R5)
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select public.check_out('11000000-0000-4000-8000-000000000001') ->> 'outcome'),
  'success',
  'Seeker can check out of their occupied reservation (R5)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  'available',
  'unit becomes immediately available in unit_states after check_out (FR-2.8)'
);

select is(
  (select count(*)::int from public.my_reservation()),
  0,
  'my_reservation with no arguments returns 0 rows after check_out'
);

select is(
  (select status from public.my_reservation('11000000-0000-4000-8000-000000000001')),
  'completed'::public.reservation_status,
  'my_reservation(id) returns completed status after check_out'
);

set local role postgres;
select ok(
  (select r.status = 'completed' and r.checked_out_at is not null and r.ended_at is not null and p.status = 'paid'
   from public.reservations r
   join public.payments p on p.reservation_id = r.id
   where r.id = '11000000-0000-4000-8000-000000000001'),
  'check_out sets completed, checked_out_at, ended_at and leaves payment paid'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.check_out('11000000-0000-4000-8000-000000000001')$$),
  'P0001 hold_ended',
  'second check_out on a completed reservation refuses with hold_ended (N11)'
);

select lives_ok(
  $$select * from public.hold_unit('f0000000-0000-4000-8000-000000000001', 30)$$,
  'checked-out Seeker can immediately hold a unit again after check_out'
);

-- Clean up that fresh hold before next section
set local role postgres;
delete from public.reservations
where seeker_id = 'c0000000-0000-4000-8000-000000000001'
  and unit_id = 'f0000000-0000-4000-8000-000000000001'
  and status = 'pending_payment';

-- Re-scanning completed token refuses (C5)
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 token_already_used',
  'check_in refuses a completed reservation token with token_already_used (C5)'
);

-- ---------------------------------------------------------------------------
-- 5. Wait window lapse on check_in (C4, R7), cancelled (C6), expired (invalid_state), and Step 2 on read
-- ---------------------------------------------------------------------------
set local role postgres;

-- Wait-window expired reserved hold r3 for check_in test (C4)
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token
) values (
  '11000000-0000-4000-8000-000000000003',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002',
  'A2',
  'reserved',
  interval '30 minutes',
  clock_timestamp() - interval '40 minutes',
  clock_timestamp() - interval '1 second',
  'W8AT00008APS'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '21000000-0000-4000-8000-000000000003',
  '11000000-0000-4000-8000-000000000003',
  'paid',
  5000,
  'pi_test_10_03',
  clock_timestamp() - interval '35 minutes'
);

-- Cancelled reservation with null unit_id (C6 edge case: unit deleted after cancel)
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token, ended_at
) values (
  '11000000-0000-4000-8000-000000000004',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  null,
  'A9',
  'cancelled',
  interval '30 minutes',
  clock_timestamp() - interval '20 minutes',
  clock_timestamp() + interval '10 minutes',
  'CANC0000VN9T',
  clock_timestamp() - interval '5 minutes'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '21000000-0000-4000-8000-000000000004',
  '11000000-0000-4000-8000-000000000004',
  'forfeited',
  5000,
  'pi_test_10_04',
  clock_timestamp() - interval '19 minutes'
);

-- Expired reservation carrying a token (defensive invalid_state branch)
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token, ended_at
) values (
  '11000000-0000-4000-8000-000000000005',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000003',
  'A3',
  'expired',
  interval '30 minutes',
  clock_timestamp() - interval '20 minutes',
  null,
  'EXPR0000T9KN',
  clock_timestamp() - interval '10 minutes'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select public.check_in('W8AT00008APS', 'e0000000-0000-4000-8000-000000000001') ->> 'outcome'),
  'wait_window_lapsed',
  'check_in on a lapsed reserved hold returns wait_window_lapsed (C4)'
);

set local role postgres;
select ok(
  (select r.status = 'no_show' and r.ended_at is not null and p.status = 'forfeited'
   from public.reservations r
   join public.payments p on p.reservation_id = r.id
   where r.id = '11000000-0000-4000-8000-000000000003'),
  'wait_window_lapsed commits no_show and forfeits payment (C4, R7)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select public.check_in('W8AT00008APS', 'e0000000-0000-4000-8000-000000000001') ->> 'outcome'),
  'wait_window_lapsed',
  'scanning an already-recorded no_show token still returns wait_window_lapsed'
);

select is(
  pg_temp.refusal($$select public.check_in('CANC0000VN9T', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 reservation_cancelled',
  'check_in refuses a cancelled reservation token with reservation_cancelled (C6)'
);

select is(
  pg_temp.refusal($$select public.check_in('EXPR0000T9KN', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 invalid_state',
  'check_in refuses a non-reserved non-terminal token state with invalid_state'
);

-- Step 2 (R7) on read via unit_states: expired wait window becomes no_show without touching host_updated_at
set local role postgres;
create temp table _unit_freshness as
select host_updated_at
from public.units
where id = 'f0000000-0000-4000-8000-000000000002';

insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token
) values (
  '11000000-0000-4000-8000-000000000006',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002',
  'A2',
  'reserved',
  interval '30 minutes',
  clock_timestamp() - interval '35 minutes',
  clock_timestamp() - interval '1 second',
  'READ0000N9SH'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '21000000-0000-4000-8000-000000000006',
  '11000000-0000-4000-8000-000000000006',
  'paid',
  5000,
  'pi_test_10_06',
  clock_timestamp() - interval '31 minutes'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000002'),
  'available',
  'unit_states frees unit immediately when wait window expires (R7)'
);

set local role postgres;
select ok(
  (select r.status = 'no_show' and p.status = 'forfeited'
   from public.reservations r
   join public.payments p on p.reservation_id = r.id
   where r.id = '11000000-0000-4000-8000-000000000006'),
  'unit_states lapse records no_show and forfeits payment (Step 2, R7)'
);

select is(
  (select host_updated_at from public.units where id = 'f0000000-0000-4000-8000-000000000002'),
  (select host_updated_at from _unit_freshness),
  'reservation no_show lapse does not change unit host_updated_at (D-051)'
);

-- ---------------------------------------------------------------------------
-- 6. Closing-time lapses: Step 3 (R6 occupied -> completed) & Step 4 (H2 host override reset)
-- ---------------------------------------------------------------------------
-- Configure e...01 to fixed hours (open now for +/- 2 hours in Asia/Manila)
update public.spaces
set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
    closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '2 hours')::time
where id = 'e0000000-0000-4000-8000-000000000001';

-- Visit r7 checked in 2 days ago (strictly before last_closing_time -> Step 3 lapses to completed)
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token, checked_in_at
) values (
  '11000000-0000-4000-8000-000000000007',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000004',
  'A4',
  'occupied',
  interval '60 minutes',
  clock_timestamp() - interval '2 days',
  clock_timestamp() - interval '2 days',
  'C89S00008APS',
  clock_timestamp() - interval '2 days'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '21000000-0000-4000-8000-000000000007',
  '11000000-0000-4000-8000-000000000007',
  'paid',
  5000,
  'pi_test_10_07',
  clock_timestamp() - interval '2 days'
);

-- Stale host overrides on f...05 (occupied) and f...06 (reserved) from 2 days ago, plus fresh override on f...07
update public.units
set host_state = 'occupied',
    host_updated_at = clock_timestamp() - interval '2 days'
where id = 'f0000000-0000-4000-8000-000000000005';

update public.units
set host_state = 'reserved',
    host_updated_at = clock_timestamp() - interval '2 days'
where id = 'f0000000-0000-4000-8000-000000000006';

update public.units
set host_state = 'occupied',
    host_updated_at = clock_timestamp() - interval '5 minutes'
where id = 'f0000000-0000-4000-8000-000000000007';

create temp table _stale_override_time as
select host_updated_at
from public.units
where id = 'f0000000-0000-4000-8000-000000000005';

-- check_out refuses closing-time lapsed visit with hold_ended (N11)
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.check_out('11000000-0000-4000-8000-000000000007')$$),
  'P0001 hold_ended',
  'check_out refuses an occupied visit whose Space has already passed closing time (N11)'
);

-- Reading unit_states records Step 3 and Step 4 lapses
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000004'),
  'available',
  'unit_states frees unit after closing time for stale occupied visit (Step 3, R6)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000005'),
  'available',
  'unit_states resets stale host occupied override to available at closing time (Step 4, H2)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000006'),
  'available',
  'unit_states resets stale host reserved override to available at closing time (Step 4, H2)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000007'),
  'occupied',
  'unit_states keeps fresh host occupied override updated after last closing time'
);

set local role postgres;
select ok(
  (select r.status = 'completed' and r.ended_at is not null and r.checked_out_at is null and p.status = 'paid'
   from public.reservations r
   join public.payments p on p.reservation_id = r.id
   where r.id = '11000000-0000-4000-8000-000000000007'),
  'closing-time lapse sets status=completed, ended_at non-null, keeps checked_out_at null and payment paid (R6)'
);

select is(
  (select host_updated_at from public.units where id = 'f0000000-0000-4000-8000-000000000005'),
  (select host_updated_at from _stale_override_time),
  'closing-time host override reset leaves host_updated_at untouched (D-051)'
);

-- 24-hour Space (e...03): stale occupied visit & host override NEVER lapse at closing time
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token, checked_in_at
) values (
  '11000000-0000-4000-8000-000000000008',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000003',
  'f0000000-0000-4000-8000-000000000018',
  'U2',
  'occupied',
  interval '60 minutes',
  clock_timestamp() - interval '3 days',
  clock_timestamp() - interval '3 days',
  'TWNT0000F9VR',
  clock_timestamp() - interval '3 days'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '21000000-0000-4000-8000-000000000008',
  '11000000-0000-4000-8000-000000000008',
  'paid',
  5000,
  'pi_test_10_08',
  clock_timestamp() - interval '3 days'
);

update public.units
set host_state = 'occupied',
    host_updated_at = clock_timestamp() - interval '3 days'
where id = 'f0000000-0000-4000-8000-000000000019';

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000003')
    where unit_id = 'f0000000-0000-4000-8000-000000000018'),
  'occupied',
  '24-hour Space keeps multi-day occupied reservation open across days (D-048)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000003')
    where unit_id = 'f0000000-0000-4000-8000-000000000019'),
  'occupied',
  '24-hour Space never auto-resets host override (D-048)'
);

-- ---------------------------------------------------------------------------
-- 7. check_space_hours_on_update protects occupied visits (N22)
-- ---------------------------------------------------------------------------
-- Check-out r8 on 24h Space still works cleanly? Let's test N22 on e...03 first while r8 is occupied!
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '4 hours')::time
    where id = 'e0000000-0000-4000-8000-000000000003'$$),
  'P0001 hours_cut_hold',
  '24-hour Space with occupied visit cannot switch to closing hours (N22)'
);

-- Fixed-hours Space e...01: release seeker 2's earlier r2 hold before creating occupied visit r9
set local role postgres;
update public.reservations
set status = 'cancelled',
    ended_at = clock_timestamp()
where id = '11000000-0000-4000-8000-000000000002';

update public.spaces
set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
    closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '4 hours')::time
where id = 'e0000000-0000-4000-8000-000000000001';

insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token, checked_in_at
) values (
  '11000000-0000-4000-8000-000000000009',
  'c0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000008',
  'A8',
  'occupied',
  interval '60 minutes',
  clock_timestamp() - interval '30 minutes',
  clock_timestamp() + interval '30 minutes',
  'H9VR0000PR9T',
  clock_timestamp() - interval '15 minutes'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '21000000-0000-4000-8000-000000000009',
  '11000000-0000-4000-8000-000000000009',
  'paid',
  5000,
  'pi_test_10_09',
  clock_timestamp() - interval '25 minutes'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Bringing closing time earlier today (+4h -> +2h) refused
select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '2 hours')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 hours_cut_hold',
  'moving closing time earlier while a visit is occupied refuses with hours_cut_hold (N22)'
);

-- Setting hours so Space is closed right now (+1h .. +4h) refused
select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '1 hour')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '4 hours')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 hours_cut_hold',
  'setting hours so Space is currently closed while occupied refuses with hours_cut_hold (N22)'
);

-- Closing before check-in time (so last_closing_time > checked_in_at and closed now) refused
select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '5 minutes')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 hours_cut_hold',
  'moving closing time into an already-checked-in visit refuses with hours_cut_hold (N22)'
);

-- Extending closing time later (+4h -> +6h) succeeds
select lives_ok(
  $$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '6 hours')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'extending closing time while a visit is occupied is allowed'
);

-- Switching from fixed hours to 24 hours succeeds
select lives_ok(
  $$update public.spaces
    set opens_at = '00:00'::time,
        closes_at = '00:00'::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'switching to 24-hour operation while a visit is occupied is allowed'
);

select * from finish();
rollback;
