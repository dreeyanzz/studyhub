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
select plan(74);

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

select throws_ok(
  $$delete from public.units where id = 'f0000000-0000-4000-8000-000000000003'$$,
  'P0001',
  'unit has an active hold',
  'a Host cannot delete a unit with an active hold (Negative N17)'
);

select throws_ok(
  $$delete from public.zones where id = 'd0000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'zone contains a unit with an active hold',
  'a Host cannot delete a zone with an active hold (Negative N17)'
);

select throws_ok(
  $$delete from public.spaces where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'space contains a unit with an active hold',
  'a Host cannot delete a Space with an active hold (Negative N17)'
);

-- As Host 1: attempt N23 updates on held unit layout/label
select throws_ok(
  $$update public.units set label = 'S3-Edited' where id = 'f0000000-0000-4000-8000-000000000003'$$,
  'P0001',
  'cannot modify held unit',
  'a Host cannot change a held unit''s label (Negative N23)'
);

select throws_ok(
  $$update public.units set grid_col = 5 where id = 'f0000000-0000-4000-8000-000000000003'$$,
  'P0001',
  'cannot modify held unit',
  'a Host cannot change a held unit''s place (Negative N23)'
);

select throws_ok(
  $$update public.units set unit_type = 'standing_desk' where id = 'f0000000-0000-4000-8000-000000000003'$$,
  'P0001',
  'cannot modify held unit',
  'a Host cannot change a held unit''s type (Negative N23)'
);

select throws_ok(
  $$update public.units set capacity = 4 where id = 'f0000000-0000-4000-8000-000000000003'$$,
  'P0001',
  'cannot modify held unit',
  'a Host cannot change a held unit''s capacity (Negative N23)'
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
select throws_ok(
  $$update public.spaces
    set opens_at = ((now() at time zone 'Asia/Manila')::time + interval '2 hours')::time,
        closes_at = ((now() at time zone 'Asia/Manila')::time + interval '4 hours')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'new hours cut into active hold',
  'a Host cannot change a Space''s hours to cut into a pending or reserved hold (Negative N22)'
);

-- Case B: Setting hours such that closing time is in 15 minutes (hold ends in 70 min)
select throws_ok(
  $$update public.spaces
    set opens_at = ((now() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((now() at time zone 'Asia/Manila')::time + interval '15 minutes')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'new hours cut into active hold',
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
select throws_ok(
  $$update public.spaces
    set opens_at = ((now() at time zone 'Asia/Manila')::time - interval '2 hours')::time,
        closes_at = ((now() at time zone 'Asia/Manila')::time + interval '30 minutes')::time
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'new hours cut into active hold',
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

select * from finish();
rollback;
