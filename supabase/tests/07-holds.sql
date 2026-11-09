-- STORY-09, TSK-09.1: Reservations, payments, hold settings, helpers and refusal triggers.
-- Tests follow docs/design/STORY-09-reserve-now-holds.md §4 (Row 1)
-- and flows/reservation-lifecycle.md & flows/sandbox-payment-confirmation.md.
--
-- Seed accounts:
--   admin   a0000000-0000-4000-8000-000000000001
--   host    b0000000-0000-4000-8000-000000000001  owns e…01 (verified), e…02 (pending)
--   host2   b0000000-0000-4000-8000-000000000002  owns e…03 (verified)
--   seeker  c0000000-0000-4000-8000-000000000001
--   seeker2 c0000000-0000-4000-8000-000000000002

begin;
create extension if not exists pgtap with schema extensions;
select plan(113);

-- pgTAP's throws_ok sees an error's code and message, but not its hint, and the app tells
-- one refusal from another by the hint (design §2). This runs a statement as the current
-- role and returns '<code> <hint>' for the error it raises.
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
-- 1. Wait window validation and check constraint on spaces.max_wait_window
-- ---------------------------------------------------------------------------
select ok(private.is_valid_wait_window(interval '15 minutes'), '15 minutes is a valid wait window');
select ok(private.is_valid_wait_window(interval '30 minutes'), '30 minutes is a valid wait window');
select ok(private.is_valid_wait_window(interval '45 minutes'), '45 minutes is a valid wait window');
select ok(private.is_valid_wait_window(interval '60 minutes'), '60 minutes is a valid wait window');
select ok(private.is_valid_wait_window(interval '75 minutes'), '75 minutes is a valid wait window');
select ok(private.is_valid_wait_window(interval '90 minutes'), '90 minutes is a valid wait window');
select ok(private.is_valid_wait_window(interval '105 minutes'), '105 minutes is a valid wait window');
select ok(private.is_valid_wait_window(interval '120 minutes'), '120 minutes is a valid wait window');
select ok(not private.is_valid_wait_window(interval '10 minutes'), '10 minutes is not a valid wait window');
select ok(not private.is_valid_wait_window(interval '50 minutes'), '50 minutes is not a valid wait window');
select ok(not private.is_valid_wait_window(interval '3 hours'), '3 hours is not a valid wait window');
select ok(not private.is_valid_wait_window(null), 'null is not a valid wait window');

-- Check constraint on spaces.max_wait_window
select throws_ok(
  $$update public.spaces set max_wait_window = interval '10 minutes' where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'max_wait_window of 10 minutes rejected by its check'
);

select throws_ok(
  $$update public.spaces set max_wait_window = interval '50 minutes' where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'max_wait_window of 50 minutes rejected by its check'
);

select throws_ok(
  $$update public.spaces set max_wait_window = interval '3 hours' where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'max_wait_window of 3 hours rejected by its check'
);

select lives_ok(
  $$update public.spaces set max_wait_window = interval '30 minutes' where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'max_wait_window of 30 minutes accepted'
);

-- Reset back to 60 minutes
update public.spaces set max_wait_window = interval '60 minutes' where id = 'e0000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 2. Direct writes & reads denied on reservations, payments, settings (N6)
-- ---------------------------------------------------------------------------
-- Pre-seed test reservations as postgres
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at
) values (
  '10000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000004',
  'S4',
  'pending_payment',
  interval '60 minutes',
  now() + interval '10 minutes'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, checkout_session_id, checkout_url
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'pending',
  5000,
  'cs_test_sample_1',
  'https://paymongo.test/checkout/cs_test_sample_1'
);

-- A signed-out visitor
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select * from public.reservations$$,
  '42501',
  null,
  'a signed-out visitor cannot select from reservations'
);

select throws_ok(
  $$select * from public.payments$$,
  '42501',
  null,
  'a signed-out visitor cannot select from payments'
);

select throws_ok(
  $$select * from private.reservation_settings$$,
  '42501',
  null,
  'a signed-out visitor cannot select from private.reservation_settings'
);

select throws_ok(
  $$select * from public.my_reservation()$$,
  '42501',
  null,
  'a signed-out visitor cannot call my_reservation'
);

-- A Seeker: direct table access denied (N6)
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select * from public.reservations$$,
  '42501',
  null,
  'a Seeker cannot select reservations directly'
);

select throws_ok(
  $$update public.reservations set status = 'reserved' where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Seeker cannot change their own reservation''s or payment''s status (Negative N6)'
);

select throws_ok(
  $$delete from public.reservations where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Seeker cannot delete their own reservation directly'
);

select throws_ok(
  $$insert into public.reservations (seeker_id, space_id, unit_id, unit_label, wait_window, payment_window_ends_at)
    values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'S1', interval '15 minutes', now())$$,
  '42501',
  null,
  'a Seeker cannot insert into reservations directly'
);

select throws_ok(
  $$select * from public.payments$$,
  '42501',
  null,
  'a Seeker cannot select payments directly'
);

select throws_ok(
  $$update public.payments set status = 'paid' where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Seeker cannot update payments directly'
);

select throws_ok(
  $$select * from private.reservation_settings$$,
  '42501',
  null,
  'a Seeker cannot select private.reservation_settings directly'
);

-- ---------------------------------------------------------------------------
-- 3. Time helpers and booking token generator
-- ---------------------------------------------------------------------------
set local role postgres;

-- is_open tests
select ok(private.is_open('00:00'::time, '00:00'::time, now()), '24-hour space is always open');
select ok(private.is_open('07:00'::time, '22:00'::time, '2026-11-08 12:00:00+08'::timestamptz), 'day space is open at noon Manila');
select ok(not private.is_open('07:00'::time, '22:00'::time, '2026-11-08 05:00:00+08'::timestamptz), 'day space is closed at 5am Manila');
select ok(private.is_open('18:00'::time, '02:00'::time, '2026-11-08 20:00:00+08'::timestamptz), 'night space is open at 8pm Manila');
select ok(private.is_open('18:00'::time, '02:00'::time, '2026-11-08 01:00:00+08'::timestamptz), 'night space is open at 1am Manila');
select ok(not private.is_open('18:00'::time, '02:00'::time, '2026-11-08 12:00:00+08'::timestamptz), 'night space is closed at noon Manila');

-- next_closing_time tests
select is(private.next_closing_time('00:00'::time, '00:00'::time, now()), null, '24-hour space has no next closing time');
select is(
  private.next_closing_time('07:00'::time, '22:00'::time, '2026-11-08 15:00:00+08'::timestamptz),
  '2026-11-08 22:00:00+08'::timestamptz,
  'day space closing at 22:00 has next closing time today at 22:00'
);
select is(
  private.next_closing_time('07:00'::time, '22:00'::time, '2026-11-08 23:00:00+08'::timestamptz),
  '2026-11-09 22:00:00+08'::timestamptz,
  'day space after closing has next closing time tomorrow at 22:00'
);

-- booking token generator
create temp table token_test as
select private.new_booking_token() as token from generate_series(1, 10);

select is(
  (select count(*)::int from token_test where length(token) = 12),
  10,
  'generated booking tokens are 12 characters long'
);

select is(
  (select count(*)::int from token_test where token ~ '^[0-9A-HJKMNP-TV-Z]{12}$'),
  10,
  'generated booking tokens match Crockford base32 pattern'
);

-- ---------------------------------------------------------------------------
-- 4. my_reservation
-- ---------------------------------------------------------------------------
-- Pre-seed second reservation for seeker2 (reserved with booking token and paid payment)
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at, wait_window_ends_at, booking_token
) values (
  '10000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002',
  'S2',
  'reserved',
  interval '60 minutes',
  now() + interval '10 minutes',
  now() + interval '70 minutes',
  'ABCD23456789'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'paid',
  5000,
  'pay_test_sample_2',
  now()
);

-- As Seeker 1
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select * from public.my_reservation('10000000-0000-4000-8000-000000000002')$$,
  'my_reservation for another Seeker''s reservation returns 0 rows'
);

select results_eq(
  $$select id, status, payment_status, fee_amount, unit_label, booking_token, checkout_url is not null
    from public.my_reservation('10000000-0000-4000-8000-000000000001')$$,
  $$values (
    '10000000-0000-4000-8000-000000000001'::uuid,
    'pending_payment'::public.reservation_status,
    'pending'::public.payment_status,
    5000,
    'S4'::text,
    null::text,
    true
  )$$,
  'pending_payment reservation has null booking_token and active checkout_url'
);

select results_eq(
  $$select id, status from public.my_reservation()$$,
  $$values (
    '10000000-0000-4000-8000-000000000001'::uuid,
    'pending_payment'::public.reservation_status
  )$$,
  'my_reservation with no arguments returns caller active hold'
);

-- As Seeker 2
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select results_eq(
  $$select id, status, payment_status, booking_token, checkout_url
    from public.my_reservation('10000000-0000-4000-8000-000000000002')$$,
  $$values (
    '10000000-0000-4000-8000-000000000002'::uuid,
    'reserved'::public.reservation_status,
    'paid'::public.payment_status,
    'ABCD23456789'::text,
    null::text
  )$$,
  'my_reservation gives the token only while reserved, and the checkout only while unpaid'
);

-- Caller with no active hold gets 0 rows
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select * from public.my_reservation()$$,
  'my_reservation returns 0 rows when caller has no active hold'
);

-- ---------------------------------------------------------------------------
-- 5. unit_states with holds and privacy (N18, N25)
-- ---------------------------------------------------------------------------
-- As Host 1 (owns e...01): sees reservation_id on held units
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select unit_id, seat_state, reservation_id
    from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id in ('f0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001')
    order by unit_id$$,
  $$values
    ('f0000000-0000-4000-8000-000000000001'::uuid, 'available'::text, null::uuid),
    ('f0000000-0000-4000-8000-000000000002'::uuid, 'reserved'::text, '10000000-0000-4000-8000-000000000002'::uuid),
    ('f0000000-0000-4000-8000-000000000004'::uuid, 'pending_payment'::text, '10000000-0000-4000-8000-000000000001'::uuid)$$,
  'only the Space''s Host sees which reservation holds a unit (N25)'
);

-- As Seeker 1: reservation_id is null for all units
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select unit_id, seat_state, reservation_id
    from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id in ('f0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001')
    order by unit_id$$,
  $$values
    ('f0000000-0000-4000-8000-000000000001'::uuid, 'available'::text, null::uuid),
    ('f0000000-0000-4000-8000-000000000002'::uuid, 'reserved'::text, null::uuid),
    ('f0000000-0000-4000-8000-000000000004'::uuid, 'pending_payment'::text, null::uuid)$$,
  'unit_states shows another Seeker''s hold as a state, without the Seeker or the token (N18)'
);

-- As Anonymous visitor: reservation_id is null
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select count(*)::int from public.unit_states('e0000000-0000-4000-8000-000000000001') where reservation_id is not null),
  0,
  'unit_states for a signed-out visitor returns reservation_id null (N18, N25)'
);

-- As Host 2 (not owner of e...01): reservation_id is null
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.unit_states('e0000000-0000-4000-8000-000000000001') where reservation_id is not null),
  0,
  'unit_states for another Host returns reservation_id null (N25)'
);

-- As Administrator: reservation_id is null (N25)
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.unit_states('e0000000-0000-4000-8000-000000000001') where reservation_id is not null),
  0,
  'unit_states for an Administrator returns reservation_id null (N25)'
);

-- ---------------------------------------------------------------------------
-- 6. Lapse step 1 and Move R3
-- ---------------------------------------------------------------------------
set local role postgres;

create temp table host_updated_test as
select host_updated_at from public.units where id = 'f0000000-0000-4000-8000-000000000004';

-- Move reservation 1 payment_window_ends_at to the past
update public.reservations
set payment_window_ends_at = now() - interval '1 minute'
where id = '10000000-0000-4000-8000-000000000001';

-- Read unit_states: triggers lapse recording
select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000004'$$,
  $$values ('available'::text)$$,
  'a hold whose payment window lapsed is expired, and its unit reads Available (R3)'
);

select is(
  (select host_updated_at from public.units where id = 'f0000000-0000-4000-8000-000000000004'),
  (select host_updated_at from host_updated_test),
  'a hold and its lapse leave the Host-updated time alone (N16)'
);

select results_eq(
  $$select status, ended_at is not null from public.reservations where id = '10000000-0000-4000-8000-000000000001'$$,
  $$values ('expired'::public.reservation_status, true)$$,
  'lapsed hold status is moved to expired with ended_at set'
);

select results_eq(
  $$select status from public.payments where reservation_id = '10000000-0000-4000-8000-000000000001'$$,
  $$values ('pending'::public.payment_status)$$,
  'expired hold payment status remains pending'
);

-- As Seeker 1: hold has lapsed
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select * from public.my_reservation()$$,
  'my_reservation with no arguments returns 0 rows once caller hold has lapsed'
);

select results_eq(
  $$select status, payment_status, booking_token, checkout_url, ended_at is not null
    from public.my_reservation('10000000-0000-4000-8000-000000000001')$$,
  $$values (
    'expired'::public.reservation_status,
    'pending'::public.payment_status,
    null::text,
    null::text,
    true
  )$$,
  'my_reservation for an expired hold returns expired status, pending payment, null token and checkout'
);

-- ---------------------------------------------------------------------------
-- 7. Refusal triggers: N17 and N23
-- ---------------------------------------------------------------------------
set local role postgres;

-- Create active hold on unit S3 (f...0003) for Seeker 1
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at
) values (
  '10000000-0000-4000-8000-000000000003',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000003',
  'S3',
  'pending_payment',
  interval '30 minutes',
  now() + interval '10 minutes'
);

insert into public.payments (
  id, reservation_id, status, fee_amount
) values (
  '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000003',
  'pending',
  5000
);

-- As Host 1: attempt N17 deletes on held unit, its zone and space
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$delete from public.units where id = 'f0000000-0000-4000-8000-000000000003'$$),
  'P0001 unit_held',
  'a Host cannot delete a unit, a zone or a Space with an active hold: the unit (Negative N17)'
);

select is(
  pg_temp.refusal($$delete from public.zones where id = 'd0000000-0000-4000-8000-000000000001'$$),
  'P0001 unit_held',
  'a Host cannot delete a unit, a zone or a Space with an active hold: the zone (Negative N17)'
);

select is(
  pg_temp.refusal($$delete from public.spaces where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 unit_held',
  'a Host cannot delete a unit, a zone or a Space with an active hold: the Space (Negative N17)'
);

-- As Host 1: attempt N23 updates on held unit layout/label
select is(
  pg_temp.refusal($$update public.units set label = 'S3-Edited' where id = 'f0000000-0000-4000-8000-000000000003'$$),
  'P0001 unit_held',
  'a Host cannot change a held unit''s label, type, capacity or place: the label (Negative N23)'
);

select is(
  pg_temp.refusal($$update public.units set grid_col = 5 where id = 'f0000000-0000-4000-8000-000000000003'$$),
  'P0001 unit_held',
  'a Host cannot change a held unit''s label, type, capacity or place: the place (Negative N23)'
);

select is(
  pg_temp.refusal($$update public.units set unit_type = 'standing_desk' where id = 'f0000000-0000-4000-8000-000000000003'$$),
  'P0001 unit_held',
  'a Host cannot change a held unit''s label, type, capacity or place: the type (Negative N23)'
);

select is(
  pg_temp.refusal($$update public.units set capacity = 4 where id = 'f0000000-0000-4000-8000-000000000003'$$),
  'P0001 unit_held',
  'a Host cannot change a held unit''s label, type, capacity or place: the capacity (Negative N23)'
);

-- When hold is ended, editing the unit succeeds
set local role postgres;
update public.reservations
set status = 'cancelled', ended_at = now()
where id = '10000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$update public.units set label = 'S3-Renamed' where id = 'f0000000-0000-4000-8000-000000000003'$$,
  'a Host can edit a unit once its hold has ended'
);

-- Reset label back
update public.units set label = 'S3' where id = 'f0000000-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- 8. Refusal trigger: N22 (Space hours change)
-- ---------------------------------------------------------------------------
set local role postgres;

-- Create active hold on unit S5 (f...0005) with 60 min wait window
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at
) values (
  '10000000-0000-4000-8000-000000000005',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000005',
  'S5',
  'pending_payment',
  interval '60 minutes',
  now() + interval '10 minutes'
);

insert into public.payments (
  id, reservation_id, status, fee_amount
) values (
  '20000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000005',
  'pending',
  5000
);

-- As Host 1: update space hours so space would be closed now or close before hold ends
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Case A: Setting hours such that space is closed now
select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((now() at time zone 'Asia/Manila')::time + interval '2 hours')::time,
        closes_at = ((now() at time zone 'Asia/Manila')::time + interval '4 hours')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 hours_cut_hold',
  'a Host cannot change a Space''s hours to cut into a pending or reserved hold (Negative N22)'
);

-- Case B: Setting hours such that closing time is in 15 minutes (hold ends in 70 min)
select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((now() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((now() at time zone 'Asia/Manila')::time + interval '15 minutes')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 hours_cut_hold',
  'closing time before hold ends raises hours_cut_hold (Negative N22)'
);

-- Case C: Setting hours that do not cut into hold (open 24 hours) succeeds
select lives_ok(
  $$update public.spaces
    set opens_at = '00:00'::time,
        closes_at = '00:00'::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'setting space to 24 hours does not cut into hold'
);

-- Case D: Setting hours cutting into a reserved hold's wait_window_ends_at
select is(
  pg_temp.refusal($$update public.spaces
    set opens_at = ((now() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((now() at time zone 'Asia/Manila')::time + interval '30 minutes')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$),
  'P0001 hours_cut_hold',
  'a Host cannot change a Space''s hours to cut into a reserved hold (Negative N22)'
);

-- ---------------------------------------------------------------------------
-- 9. Constraints and Unique Indexes (N2, N3)
-- ---------------------------------------------------------------------------
set local role postgres;

-- Unique active hold per unit (N3)
select throws_ok(
  $$insert into public.reservations (
      seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at
    ) values (
      'c0000000-0000-4000-8000-000000000002',
      'e0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000005',
      'S5',
      'pending_payment',
      interval '30 minutes',
      now() + interval '10 minutes'
    )$$,
  '23505',
  null,
  'a unit cannot have two active holds, whatever inserts them'
);

-- Unique active hold per seeker (N2)
select throws_ok(
  $$insert into public.reservations (
      seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000006',
      'S6',
      'pending_payment',
      interval '30 minutes',
      now() + interval '10 minutes'
    )$$,
  '23505',
  null,
  'a Seeker with an active hold cannot hold a second unit (Negative N2)'
);

-- Check constraints on reservations table
select throws_ok(
  $$insert into public.reservations (
      seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at
    ) values (
      'c0000000-0000-4000-8000-000000000002',
      'e0000000-0000-4000-8000-000000000001',
      null,
      'S7',
      'pending_payment',
      interval '30 minutes',
      now() + interval '10 minutes'
    )$$,
  '23514',
  null,
  'active hold must have a unit_id'
);

select throws_ok(
  $$insert into public.reservations (
      seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at, booking_token
    ) values (
      'c0000000-0000-4000-8000-000000000002',
      'e0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000007',
      'S7',
      'pending_payment',
      interval '30 minutes',
      now() + interval '10 minutes',
      'ABCD23456789'
    )$$,
  '23514',
  null,
  'pending_payment reservation cannot have a booking token'
);

select throws_ok(
  $$insert into public.reservations (
      seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at, ended_at
    ) values (
      'c0000000-0000-4000-8000-000000000002',
      'e0000000-0000-4000-8000-000000000007',
      'f0000000-0000-4000-8000-000000000007',
      'S7',
      'pending_payment',
      interval '30 minutes',
      now() + interval '10 minutes',
      now()
    )$$,
  '23514',
  null,
  'pending_payment reservation cannot have ended_at set'
);

-- Check constraints on payments table
select throws_ok(
  $$insert into public.payments (
      reservation_id, status, fee_amount, external_payment_id
    ) values (
      '10000000-0000-4000-8000-000000000005',
      'pending',
      5000,
      'pay_invalid'
    )$$,
  '23514',
  null,
  'pending payment cannot have external_payment_id'
);

select throws_ok(
  $$insert into public.payments (
      reservation_id, status, fee_amount, paid_at
    ) values (
      '10000000-0000-4000-8000-000000000005',
      'paid',
      5000,
      now()
    )$$,
  '23514',
  null,
  'paid payment must have external_payment_id'
);

select throws_ok(
  $$insert into public.payments (
      reservation_id, status, fee_amount, external_payment_id, paid_at
    ) values (
      '10000000-0000-4000-8000-000000000005',
      'paid',
      0,
      'pay_sample',
      now()
    )$$,
  '23514',
  null,
  'fee_amount must be greater than 0'
);

-- ---------------------------------------------------------------------------
-- 9. public.hold_terms (D-048, D-055, D-067)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty(
  $$select * from public.hold_terms('e0000000-0000-4000-8000-000000000002')$$,
  'hold_terms for a Pending Space returns 0 rows to anon (D-055)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select * from public.hold_terms('e0000000-0000-4000-8000-000000000002')$$,
  'hold_terms for a Pending Space returns 0 rows to a Seeker (D-055)'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is_empty(
  $$select * from public.hold_terms('e0000000-0000-4000-8000-000000000002')$$,
  'hold_terms for a Pending Space returns 0 rows to another Host (D-055)'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select fee_amount, payment_window_minutes, max_wait_window_minutes from public.hold_terms('e0000000-0000-4000-8000-000000000002')$$,
  $$values (5000, 10, 60)$$,
  'space Host can read hold_terms for their own Pending Space'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select fee_amount, payment_window_minutes, max_wait_window_minutes from public.hold_terms('e0000000-0000-4000-8000-000000000002')$$,
  $$values (5000, 10, 60)$$,
  'Administrator can read hold_terms for a Pending Space'
);

-- Sulok Co-working is 24 hours (verified), max_wait_window = 60 min
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$select fee_amount, payment_window_minutes, max_wait_window_minutes, is_open, wait_window_minutes from public.hold_terms('e0000000-0000-4000-8000-000000000003')$$,
  $$values (5000, 10, 60, true, array[15, 30, 45, 60])$$,
  'hold_terms for 24h space returns all wait windows up to max_wait_window'
);

-- Test space an hour before closing
set local role postgres;
update public.reservations
set status = 'cancelled', ended_at = clock_timestamp()
where space_id = 'e0000000-0000-4000-8000-000000000001'
  and status in ('pending_payment', 'reserved', 'occupied');

update public.spaces
set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
    closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '1 hour')::time
where id = 'e0000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select is_open, wait_window_minutes from public.hold_terms('e0000000-0000-4000-8000-000000000001')$$,
  $$values (true, array[15, 30, 45])$$,
  'hold_terms an hour before closing returns only the wait windows that fit (D-048)'
);

-- Test space closed
set local role postgres;
update public.spaces
set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '2 hours')::time,
    closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '4 hours')::time
where id = 'e0000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select is_open, wait_window_minutes from public.hold_terms('e0000000-0000-4000-8000-000000000001')$$,
  $$values (false, '{}'::integer[])$$,
  'hold_terms for closed space returns is_open false and empty wait windows'
);

-- Reset Kapihan Study Hall back to 07:00-22:00
set local role postgres;
update public.spaces
set opens_at = '07:00'::time,
    closes_at = '22:00'::time
where id = 'e0000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 10. public.hold_unit (R1, N1-N5, FR-2.1, FR-2.5)
-- ---------------------------------------------------------------------------
-- Caller must be a Seeker (N5)
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select * from public.hold_unit('f0000000-0000-4000-8000-000000000017', 30)$$,
  '42501',
  null,
  'a signed-out visitor cannot call hold_unit (Negative N5)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select * from public.hold_unit('f0000000-0000-4000-8000-000000000017', 30)$$,
  '42501',
  'Only Seeker accounts can hold units.',
  'a Host and an Administrator cannot hold a unit: the Host (Negative N5)'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select * from public.hold_unit('f0000000-0000-4000-8000-000000000017', 30)$$,
  '42501',
  'Only Seeker accounts can hold units.',
  'a Host and an Administrator cannot hold a unit: the Administrator (Negative N5)'
);

-- Refusal a: unit_not_found (non-existent unit)
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-999999999999', 30)$$),
  'P0001 unit_not_found',
  'hold_unit on non-existent unit raises unit_not_found (Negative N4)'
);

-- Refusal a: unit_not_found (unit in Pending Space)
select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-000000000015', 30)$$),
  'P0001 unit_not_found',
  'a Seeker cannot hold a unit in a Space that is not Verified (Negative N4, D-055)'
);

-- Refusal b: space_closed
set local role postgres;
update public.spaces
set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '2 hours')::time,
    closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '4 hours')::time
where id = 'e0000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-000000000006', 30)$$),
  'P0001 space_closed',
  'hold_unit when Space is closed raises space_closed (Negative N4)'
);

set local role postgres;
update public.spaces
set opens_at = '07:00'::time,
    closes_at = '22:00'::time
where id = 'e0000000-0000-4000-8000-000000000001';

-- Refusal c: wait_window_not_allowed (invalid step)
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-000000000017', 20)$$),
  'P0001 wait_window_not_allowed',
  'hold_unit with invalid wait window raises wait_window_not_allowed (Negative N4)'
);

-- Refusal c: wait_window_not_allowed (exceeds Space max_wait_window)
select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-000000000017', 90)$$),
  'P0001 wait_window_not_allowed',
  'hold_unit with wait window exceeding space max raises wait_window_not_allowed (Negative N4)'
);

-- Refusal c: wait_window_not_allowed (null wait window)
select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-000000000017', null)$$),
  'P0001 wait_window_not_allowed',
  'hold_unit with null wait window raises wait_window_not_allowed (Negative N4)'
);

-- Refusal d: wait_window_past_closing
set local role postgres;
update public.spaces
set opens_at = ((clock_timestamp() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
    closes_at = ((clock_timestamp() at time zone 'Asia/Manila')::time + interval '20 minutes')::time
where id = 'e0000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-000000000006', 15)$$),
  'P0001 wait_window_past_closing',
  'hold_unit with wait window past closing raises wait_window_past_closing (Negative N4, D-048)'
);

set local role postgres;
update public.spaces
set opens_at = '07:00'::time,
    closes_at = '22:00'::time
where id = 'e0000000-0000-4000-8000-000000000001';

-- Refusal e: unit_not_available (unit host_state != 'available')
set local role postgres;
update public.units
set host_state = 'occupied'
where id = 'f0000000-0000-4000-8000-000000000018';

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-000000000018', 30)$$),
  'P0001 unit_not_available',
  'hold_unit on occupied unit raises unit_not_available (Negative N1)'
);

set local role postgres;
update public.units
set host_state = 'available'
where id = 'f0000000-0000-4000-8000-000000000018';

-- Success case: Seeker 1 holds U1 (f...0017) at Sulok Co-working
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select status, checkout_url, created from public.hold_unit('f0000000-0000-4000-8000-000000000017', 30)$$,
  $$values ('pending_payment'::public.reservation_status, null::text, true)$$,
  'Seeker 1 holds an available unit: returns pending_payment, created true'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000003') where unit_id = 'f0000000-0000-4000-8000-000000000017'$$,
  $$values ('pending_payment')$$,
  'a Seeker holds an Available unit, which reads Pending Payment'
);

-- Refusal e: unit_not_available (unit has an active hold)
-- As Seeker 2: try to hold U1 (already held by Seeker 1)
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-000000000017', 30)$$),
  'P0001 unit_not_available',
  'a Seeker cannot hold a unit that is not Available (Negative N1)'
);

-- Refusal f: seeker_has_hold (caller already holds another unit)
-- As Seeker 1 (who holds U1): try to hold U2
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select * from public.hold_unit('f0000000-0000-4000-8000-000000000018', 30)$$),
  'P0001 seeker_has_hold',
  'a Seeker with an active hold cannot hold a second unit (Negative N2)'
);

-- Double tap: Seeker 1 calls hold_unit on U1 again (same unit they hold)
select results_eq(
  $$select status, checkout_url, created from public.hold_unit('f0000000-0000-4000-8000-000000000017', 30)$$,
  $$values ('pending_payment'::public.reservation_status, null::text, false)$$,
  'a Seeker asking again for the unit they hold gets the same hold back'
);

-- Seeker whose own hold lapsed can hold another unit
-- Manually expire Seeker 1's hold on U1
set local role postgres;
update public.reservations
set payment_window_ends_at = clock_timestamp() - interval '1 second'
where unit_id = 'f0000000-0000-4000-8000-000000000017';

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Seeker 1 holds U2: should succeed because lapse on U1 is recorded first
select results_eq(
  $$select status, checkout_url, created from public.hold_unit('f0000000-0000-4000-8000-000000000018', 30)$$,
  $$values ('pending_payment'::public.reservation_status, null::text, true)$$,
  'Seeker whose own hold lapsed holds another unit succeeds (lapse recorded first)'
);

-- ---------------------------------------------------------------------------
-- 11. public.cancel_hold (R4, R8, N8, N11, N21)
-- ---------------------------------------------------------------------------
-- Seeker 1 now holds U2 ('f...0018') in pending_payment
-- Get Seeker 1's reservation id on U2
set local role postgres;
create temp table _seeker1_hold as
select id from public.reservations
where unit_id = 'f0000000-0000-4000-8000-000000000018'
  and status = 'pending_payment';
grant all on _seeker1_hold to public;

-- 1. Non-authenticated cannot call cancel_hold
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.cancel_hold((select id from _seeker1_hold), 'pending_payment')$$,
  '42501',
  null,
  'anon cannot call cancel_hold'
);

-- 2. Another Seeker cannot cancel Seeker 1's hold (Negative N8)
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.cancel_hold((select id from _seeker1_hold), 'pending_payment')$$,
  '42501',
  'permission denied',
  'a Seeker cannot cancel another Seeker''s hold (Negative N8)'
);

-- 3. Host cannot cancel Seeker's hold via cancel_hold (Negative N8)
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.cancel_hold((select id from _seeker1_hold), 'pending_payment')$$,
  '42501',
  'permission denied',
  'a Host cannot cancel a Seeker''s hold via cancel_hold (Negative N8)'
);

-- 4. Refusal: hold_changed (expected_status mismatch, Negative N21)
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.cancel_hold((select id from _seeker1_hold), 'reserved')$$),
  'P0001 hold_changed',
  'a Seeker''s cancel is refused once their hold has changed (Negative N21)'
);

-- 5. R4: Seeker 1 cancels their unpaid pending_payment hold
select lives_ok(
  $$select public.cancel_hold((select id from _seeker1_hold), 'pending_payment')$$,
  'a Seeker cancels their unpaid hold, and the unit reads Available (Move R4)'
);

-- Verify reservation status is cancelled and payment is pending
set local role postgres;
select results_eq(
  $$select status, ended_at is not null from public.reservations where id = (select id from _seeker1_hold)$$,
  $$values ('cancelled'::public.reservation_status, true)$$,
  'cancelled unpaid hold has status cancelled and ended_at set'
);

select results_eq(
  $$select status from public.payments where reservation_id = (select id from _seeker1_hold)$$,
  $$values ('pending'::public.payment_status)$$,
  'cancelled unpaid hold payment remains pending'
);

-- Unit U2 is now Available in unit_states
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000003') where unit_id = 'f0000000-0000-4000-8000-000000000018'$$,
  $$values ('available')$$,
  'unit reads Available once unpaid hold is cancelled'
);

-- 6. Refusal: hold_ended (cancelling an already ended hold, Negative N11)
select is(
  pg_temp.refusal($$select public.cancel_hold((select id from _seeker1_hold), 'cancelled')$$),
  'P0001 hold_ended',
  'an ended reservation cannot move again (Negative N11)'
);

-- 7. R8: Paid hold cancellation (reserved -> cancelled, payment forfeited)
-- Create a reserved hold for Seeker 2 on U3 ('f...0019')
set local role postgres;
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, wait_window_ends_at, booking_token
) values (
  '10000000-0000-4000-8000-000000000099',
  'c0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000003',
  'f0000000-0000-4000-8000-000000000019',
  'U3',
  'reserved',
  interval '30 minutes',
  now() - interval '5 minutes',
  now() + interval '25 minutes',
  'TK9923456789'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '20000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000099',
  'paid',
  5000,
  'pay_test_forfeit_1',
  now() - interval '5 minutes'
);

-- As Seeker 2: cancel the paid reservation
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select lives_ok(
  $$select public.cancel_hold('10000000-0000-4000-8000-000000000099', 'reserved')$$,
  'a Seeker who cancels a paid hold forfeits the fee (Move R8)'
);

-- Verify reservation is cancelled, ended_at set, payment forfeited
set local role postgres;
select results_eq(
  $$select status, ended_at is not null from public.reservations where id = '10000000-0000-4000-8000-000000000099'$$,
  $$values ('cancelled'::public.reservation_status, true)$$,
  'cancelled paid hold has status cancelled and ended_at set'
);

select results_eq(
  $$select status from public.payments where reservation_id = '10000000-0000-4000-8000-000000000099'$$,
  $$values ('forfeited'::public.payment_status)$$,
  'cancelled paid hold payment is forfeited (Move R8)'
);

-- Unit U3 is now Available in unit_states
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000003') where unit_id = 'f0000000-0000-4000-8000-000000000019'$$,
  $$values ('available')$$,
  'unit reads Available once paid hold is cancelled'
);

-- 8. Refusal: checked_in (when reservation is occupied)
set local role postgres;
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, wait_window_ends_at, booking_token, checked_in_at
) values (
  '10000000-0000-4000-8000-000000000088',
  'c0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000003',
  'f0000000-0000-4000-8000-000000000019',
  'U3',
  'occupied',
  interval '30 minutes',
  now() - interval '10 minutes',
  now() + interval '20 minutes',
  'WXYZ23456789',
  now()
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.cancel_hold('10000000-0000-4000-8000-000000000088', 'occupied')$$),
  'P0001 checked_in',
  'cancel_hold on occupied reservation raises checked_in'
);

select * from finish();
rollback;

