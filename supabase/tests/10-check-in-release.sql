-- STORY-10, TSK-10.1: Booking token check-in, check-out, complete lapse recording, and closing-time protection.
-- Tests docs/design/STORY-10-check-in-release.md §2 & §4, docs/flows/check-in.md, and
-- docs/flows/reservation-lifecycle.md (C1-C7, C-N1 to C-N4, R6, R7, R10, R12, H3, N8 to N11, N16, N20,
-- N22, N24).
--
-- Seed accounts:
--   admin   a0000000-0000-4000-8000-000000000001
--   host    b0000000-0000-4000-8000-000000000001  owns e...01 (verified, units f...01..14)
--   host2   b0000000-0000-4000-8000-000000000002  owns e...03 (verified, 24h, units f...17..19)
--   seeker  c0000000-0000-4000-8000-000000000001
--   seeker2 c0000000-0000-4000-8000-000000000002

begin;
create extension if not exists pgtap with schema extensions;
select plan(73);

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
-- 1. private.last_closing_time (D-027, D-048) & direct access checks
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

select is(
  private.last_closing_time('18:00'::time, '02:00'::time, '2026-11-14 03:00:00+08'::timestamptz),
  '2026-11-14 02:00:00+08'::timestamptz,
  'overnight space after early-morning closing returns that morning closing time'
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

-- f...01's Host-updated time before its check-in and check-out (N16)
create temp table _f01_freshness as
select host_updated_at
from public.units
where id = 'f0000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 2. Grants & authorization boundaries (C7, N9, N20, N24)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select private.last_closing_time('07:00'::time, '22:00'::time, now())$$,
  '42501',
  null,
  'a signed-out visitor cannot call private.last_closing_time (N24)'
);

select throws_ok(
  $$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'a signed-out visitor cannot call check_in (C7, N24)'
);

select throws_ok(
  $$select public.check_out('11000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'a signed-out visitor cannot call check_out (N24)'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'only the Space''s Host sees when a wait window ends: not a signed-out visitor (N20)'
);

-- Seeker 1 cannot check in or read wait_window_ends_at in unit_states
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'a Seeker cannot check in their own reservation (C7, N9)'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'only the Space''s Host sees when a wait window ends: not a Seeker (N20)'
);

select is(
  pg_temp.refusal($$select public.check_out('11000000-0000-4000-8000-000000000001')$$),
  'P0001 not_checked_in',
  'a Seeker cannot check out a hold they have not checked in to'
);

-- Host 2 and Admin cannot check in at Host 1 space or read wait_window_ends_at
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'another Host cannot check in a Space they do not own (C7)'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'only the Space''s Host sees when a wait window ends: not another Host (N20)'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'an Administrator cannot check in at a Space they do not own (C7)'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'only the Space''s Host sees when a wait window ends: not an Administrator (N20)'
);

-- Host 1 sees wait_window_ends_at on reserved hold in unit_states
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select ok(
  (select wait_window_ends_at is not null
   from public.unit_states('e0000000-0000-4000-8000-000000000001')
   where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  'only the Space''s Host sees when a wait window ends: the Host does, while Reserved (N20)'
);

-- ---------------------------------------------------------------------------
-- 3. public.check_in token validation, wrong space, and check-in transition (C1, C3, C5, C6, C-N1, C-N2, C-N4, R6)
-- ---------------------------------------------------------------------------
select is(
  pg_temp.refusal($$select public.check_in('N9PE1234N9PE', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 invalid_token',
  'an invalid token string is rejected (C6)'
);

select is(
  pg_temp.refusal($$select public.check_in(null, 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 invalid_token',
  'an invalid token string is rejected: a null token (C6)'
);

select is(
  pg_temp.refusal($$select public.check_in('WXYZ9876KMNP', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 wrong_space',
  'a Host cannot check in a token for another Space (C5, C-N1)'
);

set local role postgres;
select ok(
  (select r.status = 'reserved' and p.status = 'paid'
   from public.reservations r
   join public.payments p on p.reservation_id = r.id
   where r.id = '11000000-0000-4000-8000-000000000002'),
  'a Host cannot check in a token for another Space: its reservation stays reserved, its payment paid (C5)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select set_config(
    'test.check_in_result',
    public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')::text,
    true
  )::jsonb ->> 'outcome'),
  'success',
  'a Host checks in a Reserved unit, which reads Occupied (C1, R6)'
);

select is(
  (select array_agg(k order by k)
   from jsonb_object_keys(current_setting('test.check_in_result')::jsonb) k),
  array['outcome', 'unit_id', 'unit_label', 'zone_name'],
  'check_in returns unit and zone labels without Seeker identity (C-N4)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  'occupied',
  'a Host checks in a Reserved unit, which reads Occupied: unit_states reads occupied (C1, R6)'
);

select is(
  (select wait_window_ends_at from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  null::timestamptz,
  'only the Space''s Host sees when a wait window ends: not once checked in (N20)'
);

-- Verify checked-in state as postgres and via Seeker my_reservation
set local role postgres;
select ok(
  (select r.status = 'occupied' and r.checked_in_at is not null and r.ended_at is null
     and p.status = 'paid'
   from public.reservations r
   join public.payments p on p.reservation_id = r.id
   where r.id = '11000000-0000-4000-8000-000000000001'),
  'a Host checks in a Reserved unit, which reads Occupied: checked_in_at stamped, payment stays paid (C1, R6)'
);

select is(
  (select host_updated_at from public.units where id = 'f0000000-0000-4000-8000-000000000001'),
  (select host_updated_at from _f01_freshness),
  'a check-in, a check-out and closing time leave the Host-updated time alone: check-in (N16)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select ok(
  (select status = 'occupied' and booking_token is null and checked_in_at is not null
   from public.my_reservation()),
  'my_reservation returns checked_in_at: the caller''s visit has it, with no booking token once occupied'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.my_reservation('11000000-0000-4000-8000-000000000001')),
  0,
  'my_reservation returns checked_in_at: another Seeker asking for that id gets 0 rows'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.set_unit_state('f0000000-0000-4000-8000-000000000001', 'available')$$),
  'P0001 hold_not_named',
  'Host tap without naming active occupied hold refuses with hold_not_named (N14, D-050)'
);

-- Re-scanning occupied reservation token refuses (C3, C-N2)

select is(
  pg_temp.refusal($$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 token_already_used',
  'a token cannot be checked in twice: while occupied (C3, C-N2)'
);

-- ---------------------------------------------------------------------------
-- 4. public.check_out authorization, release, and invalid states (R10, N8, N11, N16)
-- ---------------------------------------------------------------------------
-- Other Seeker and Host cannot check out Seeker 1's occupied reservation (N8)
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.check_out('11000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'a Seeker cannot check out another Seeker''s visit (N8)'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.check_out('11000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'a Seeker cannot check out another Seeker''s visit: nor can the Host (N8)'
);

-- Seeker 1 checks out of occupied reservation r1 (R10)
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select public.check_out('11000000-0000-4000-8000-000000000001') ->> 'outcome'),
  'success',
  'a Seeker checks out, and the unit reads Available (R10)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000001'),
  'available',
  'a Seeker checks out, and the unit reads Available: unit_states reads available (R10)'
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
  'a Seeker checks out, and the unit reads Available: completed, checked_out_at and ended_at stamped, payment stays paid (R10)'
);

select is(
  (select host_updated_at from public.units where id = 'f0000000-0000-4000-8000-000000000001'),
  (select host_updated_at from _f01_freshness),
  'a check-in, a check-out and closing time leave the Host-updated time alone: check-out (N16)'
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

-- Re-scanning completed token refuses (C3, C-N2)
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.check_in('ABCD1234EFGH', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 token_already_used',
  'a token cannot be checked in twice: after check-out (C3, C-N2)'
);

-- ---------------------------------------------------------------------------
-- 5. Wait window lapse on check_in (C2, N10, R7), cancelled (C4), expired (C-N3), and Step 2 on read
-- ---------------------------------------------------------------------------
set local role postgres;

-- Wait-window expired reserved hold r3 for check_in test (C2)
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

-- Cancelled reservation with null unit_id (C4 edge case: unit deleted after cancel)
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

-- Expired reservation carrying a token (C-N3: an expired hold paid late, P2)
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
  'a booking token cannot check in once its wait window has lapsed (C2, N10)'
);

set local role postgres;
select ok(
  (select r.status = 'no_show' and r.ended_at is not null and p.status = 'forfeited'
   from public.reservations r
   join public.payments p on p.reservation_id = r.id
   where r.id = '11000000-0000-4000-8000-000000000003'),
  'a booking token cannot check in once its wait window has lapsed: no_show and forfeited (C2, R7)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000002'),
  'available',
  'a booking token cannot check in once its wait window has lapsed: the unit reads Available (C2)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select public.check_in('W8AT00008APS', 'e0000000-0000-4000-8000-000000000001') ->> 'outcome'),
  'wait_window_lapsed',
  'a booking token cannot check in once its wait window has lapsed: a second scan says the same (C2)'
);

select is(
  pg_temp.refusal($$select public.check_in('CANC0000VN9T', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 reservation_cancelled',
  'a cancelled reservation cannot be checked in (C4)'
);

select is(
  pg_temp.refusal($$select public.check_in('EXPR0000T9KN', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 invalid_state',
  'a pending_payment hold cannot be checked in: a token on an expired hold gets invalid_state (C-N3)'
);

set local role postgres;

select throws_ok(
  $$insert into public.reservations (
      seeker_id, space_id, unit_id, unit_label, status,
      wait_window, payment_window_ends_at, booking_token
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000003',
      'A3',
      'pending_payment',
      interval '30 minutes',
      clock_timestamp() + interval '10 minutes',
      'PEND00000001'
    )$$,
  '23514',
  null,
  'a pending_payment hold cannot be checked in: a pending_payment hold has no token (C-N3)'
);

-- Cancelling at the counter before the scan (C4): reserved hold r10, cancelled by its Seeker
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status,
  wait_window, payment_window_ends_at, wait_window_ends_at, booking_token
) values (
  '11000000-0000-4000-8000-000000000010',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000003',
  'A3',
  'reserved',
  interval '60 minutes',
  clock_timestamp() - interval '5 minutes',
  clock_timestamp() + interval '55 minutes',
  'CNTR00000001'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '21000000-0000-4000-8000-000000000010',
  '11000000-0000-4000-8000-000000000010',
  'paid',
  5000,
  'pi_test_10_10',
  clock_timestamp() - interval '5 minutes'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.cancel_hold('11000000-0000-4000-8000-000000000010', 'reserved')$$,
  'cancelling at counter before scan refuses check-in: the Seeker cancels first (C4)'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.check_in('CNTR00000001', 'e0000000-0000-4000-8000-000000000001')$$),
  'P0001 reservation_cancelled',
  'cancelling at counter before scan refuses check-in (C4)'
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
  'a no-show releases the unit and forfeits the fee: the unit reads Available (R7)'
);

set local role postgres;
select ok(
  (select r.status = 'no_show' and p.status = 'forfeited'
   from public.reservations r
   join public.payments p on p.reservation_id = r.id
   where r.id = '11000000-0000-4000-8000-000000000006'),
  'a no-show releases the unit and forfeits the fee (R7)'
);

select is(
  (select host_updated_at from public.units where id = 'f0000000-0000-4000-8000-000000000002'),
  (select host_updated_at from _unit_freshness),
  'a no-show leaves the Host-updated time alone (N16, D-051)'
);

-- ---------------------------------------------------------------------------
-- 6. Closing-time lapses: Step 3 (R12 occupied -> completed) & Step 4 (H3 host override reset)
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
  'check-out after closing time finds the visit already completed (N11)'
);

-- Reading unit_states records Step 3 and Step 4 lapses
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000004'),
  'available',
  'closing time completes a visit, and the unit reads Available (R12)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000005'),
  'available',
  'closing time resets a Host-set state without moving the Host-updated time: Occupied (H3)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000006'),
  'available',
  'closing time resets a Host-set state without moving the Host-updated time: Reserved (H3)'
);

select is(
  (select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000007'),
  'occupied',
  'closing time resets a Host-set state without moving the Host-updated time: a state set after closing stays (H3)'
);

set local role postgres;
select ok(
  (select r.status = 'completed' and r.ended_at is not null and r.checked_out_at is null and p.status = 'paid'
   from public.reservations r
   join public.payments p on p.reservation_id = r.id
   where r.id = '11000000-0000-4000-8000-000000000007'),
  'closing time completes a visit, and the unit reads Available: completed, checked_out_at null, payment paid (R12)'
);

select is(
  (select host_updated_at from public.units where id = 'f0000000-0000-4000-8000-000000000005'),
  (select host_updated_at from _stale_override_time),
  'a check-in, a check-out and closing time leave the Host-updated time alone: closing time (N16, D-051)'
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
-- N22 on the 24-hour Space e...03, while visit r8 is occupied
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '4 hours')::time
    where id = 'e0000000-0000-4000-8000-000000000003'$$),
  'P0001 hours_cut_hold',
  'a Host cannot change a Space''s hours to end a visit early: 24 hours to fixed hours (N22)'
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
  'a Host cannot change a Space''s hours to end a visit early: an earlier next closing time (N22)'
);

-- Setting hours so Space is closed right now (+1h .. +4h) refused
select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '1 hour')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '4 hours')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 hours_cut_hold',
  'a Host cannot change a Space''s hours to end a visit early: hours under which the Space is closed now (N22)'
);

-- Closing before check-in time (so last_closing_time > checked_in_at and closed now) refused
select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '5 minutes')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 hours_cut_hold',
  'a Host cannot change a Space''s hours to end a visit early: a closing time since the check-in, with the Space closed now (N22)'
);

-- New hours that opened 2 minutes ago and closed 5 minutes ago, 10 minutes after r9's check-in.
-- The Space still reads open, so only the last-closing-time rule refuses them (design §2, N22).
set local role postgres;
select ok(
  private.is_open(
    ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 minutes')::time,
    ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '5 minutes')::time,
    clock_timestamp()
  ),
  'a Host cannot change a Space''s hours to end a visit early: under the next hours the Space still reads open (N22)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 minutes')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '5 minutes')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 hours_cut_hold',
  'a Host cannot change a Space''s hours to end a visit early: a last closing time after the check-in, with the Space open (N22)'
);

-- Extending closing time later (+4h -> +6h) succeeds
select lives_ok(
  $$update public.spaces
    set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '6 hours')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'a Host cannot change a Space''s hours to end a visit early: a later closing time is accepted (N22)'
);

-- Switching from fixed hours to 24 hours succeeds
select lives_ok(
  $$update public.spaces
    set opens_at = '00:00'::time,
        closes_at = '00:00'::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'a Host cannot change a Space''s hours to end a visit early: switching to 24 hours is accepted (N22)'
);

select * from finish();
rollback;
