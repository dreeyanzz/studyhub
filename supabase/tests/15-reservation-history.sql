-- STORY-16, TSK-16.1: Seeker reservation history function (`public.my_reservation_history`).
-- Tests docs/design/STORY-16-reservation-history.md §2 and §4 (D-047, D-052, D-055, D-080, D-081).
--
-- Seed accounts:
--   admin   a0000000-0000-4000-8000-000000000001  Alma Reyes
--   host    b0000000-0000-4000-8000-000000000001  Hugo Santos
--   seeker  c0000000-0000-4000-8000-000000000001  Sam Dela Cruz (0 seeded reservations)
--   seeker2 c0000000-0000-4000-8000-000000000002  Rina Bautista (2 seeded completed visits)
-- Made here:
--   seeker3 16d00000-0000-4000-8000-000000000001  active pending_payment hold
--   seeker4 16d00000-0000-4000-8000-000000000002  active occupied visit
--   seeker5 16d00000-0000-4000-8000-000000000003  lapsed reserved hold (lazy no_show + forfeited)
--   seeker6 16d00000-0000-4000-8000-000000000004  105 paid ended holds (paging & clamping)

begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- ---------------------------------------------------------------------------
-- 0. Fixtures, as postgres
-- ---------------------------------------------------------------------------
set local role postgres;

insert into auth.users (instance_id, id, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-8000-000000000000', '16d00000-0000-4000-8000-000000000001',
   'seeker3.history@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Pending Seeker"}'),
  ('00000000-0000-0000-8000-000000000000', '16d00000-0000-4000-8000-000000000002',
   'seeker4.history@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Occupied Seeker"}'),
  ('00000000-0000-0000-0000-000000000000', '16d00000-0000-4000-8000-000000000003',
   'seeker5.history@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Lapsed Seeker"}'),
  ('00000000-0000-4000-8000-000000000000', '16d00000-0000-4000-8000-000000000004',
   'seeker6.history@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Paged Seeker"}');

-- Sam's reservations (1600...01..11)
--   01: completed + paid, checked in, no review, verified space e...01, unit S1 (oldest)
--   02: completed + paid, checked in, visible review, pending space e...02, unit N1
--   03: completed + paid, checked in, hidden review, verified space e...01, unit S2 (deleted below)
--   04: completed + paid, checked in, removed review, verified space e...01, unit S3
--   05: cancelled + refunded, not checked in, verified space e...01, unit S4
--   06: expired + paid (P2 late payment), not checked in, verified space e...01, unit S5
--   07: no_show + forfeited, not checked in, verified space e...01, unit S6 (newest listed)
--   08: expired + pending (R3 unpaid lapse, excluded)
--   09: cancelled + pending (R4 unpaid cancel, excluded)
--   11: active reserved + paid (future wait window, excluded)
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, wait_window_ends_at, booking_token,
  checked_in_at, checked_out_at, ended_at, created_at
) values
  ('16000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'S1',
   'completed', interval '60 minutes', now() - interval '350 minutes', now() - interval '290 minutes',
   'HST000000001', now() - interval '330 minutes', now() - interval '300 minutes',
   now() - interval '300 minutes', now() - interval '6 hours'),
  ('16000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000015', 'N1',
   'completed', interval '60 minutes', now() - interval '290 minutes', now() - interval '230 minutes',
   'HST000000002', now() - interval '270 minutes', now() - interval '240 minutes',
   now() - interval '240 minutes', now() - interval '5 hours'),
  ('16000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'S2',
   'completed', interval '60 minutes', now() - interval '230 minutes', now() - interval '170 minutes',
   'HST000000003', now() - interval '210 minutes', now() - interval '180 minutes',
   now() - interval '180 minutes', now() - interval '4 hours'),
  ('16000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'S3',
   'completed', interval '60 minutes', now() - interval '170 minutes', now() - interval '110 minutes',
   'HST000000004', now() - interval '150 minutes', now() - interval '120 minutes',
   now() - interval '120 minutes', now() - interval '3 hours'),
  ('16000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004', 'S4',
   'cancelled', interval '60 minutes', now() - interval '110 minutes', now() - interval '50 minutes',
   'HST000000005', null, null,
   now() - interval '105 minutes', now() - interval '2 hours'),
  ('16000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000005', 'S5',
   'expired', interval '30 minutes', now() - interval '80 minutes', null,
   null, null, null,
   now() - interval '80 minutes', now() - interval '90 minutes'),
  ('16000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000006', 'S6',
   'no_show', interval '30 minutes', now() - interval '60 minutes', now() - interval '30 minutes',
   'HST000000007', null, null,
   now() - interval '30 minutes', now() - interval '70 minutes'),
  ('16000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000007', 'S7',
   'expired', interval '30 minutes', now() - interval '40 minutes', null,
   null, null, null,
   now() - interval '40 minutes', now() - interval '50 minutes'),
  ('16000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000008', 'S8',
   'cancelled', interval '30 minutes', now() - interval '30 minutes', null,
   null, null, null,
   now() - interval '35 minutes', now() - interval '40 minutes'),
  ('16000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000011', 'D3',
   'reserved', interval '60 minutes', now() - interval '3 minutes', now() + interval '55 minutes',
   'HST000000011', null, null,
   null, now() - interval '4 minutes');

insert into public.payments (
  id, reservation_id, status, fee_amount, checkout_session_id, external_payment_id, paid_at,
  refund_id, refunded_at, refunded_by, refund_reason
) values
  ('26000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001',
   'paid', 5000, 'cs_test_16_01', 'pi_test_16_01', now() - interval '355 minutes',
   null, null, null, null),
  ('26000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002',
   'paid', 5000, 'cs_test_16_02', 'pi_test_16_02', now() - interval '295 minutes',
   null, null, null, null),
  ('26000000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000003',
   'paid', 5000, 'cs_test_16_03', 'pi_test_16_03', now() - interval '235 minutes',
   null, null, null, null),
  ('26000000-0000-4000-8000-000000000004', '16000000-0000-4000-8000-000000000004',
   'paid', 5000, 'cs_test_16_04', 'pi_test_16_04', now() - interval '175 minutes',
   null, null, null, null),
  ('26000000-0000-4000-8000-000000000005', '16000000-0000-4000-8000-000000000005',
   'refunded', 5000, 'cs_test_16_05', 'pi_test_16_05', now() - interval '115 minutes',
   're_test_16_05', now() - interval '100 minutes', 'a0000000-0000-4000-8000-000000000001',
   'Host could not honour the hold.'),
  ('26000000-0000-4000-8000-000000000006', '16000000-0000-4000-8000-000000000006',
   'paid', 5000, 'cs_test_16_06', 'pi_test_16_06', now() - interval '75 minutes',
   null, null, null, null),
  ('26000000-0000-4000-8000-000000000007', '16000000-0000-4000-8000-000000000007',
   'forfeited', 5000, 'cs_test_16_07', 'pi_test_16_07', now() - interval '65 minutes',
   null, null, null, null),
  ('26000000-0000-4000-8000-000000000008', '16000000-0000-4000-8000-000000000008',
   'pending', 5000, 'cs_test_16_08', null, null,
   null, null, null, null),
  ('26000000-0000-4000-8000-000000000009', '16000000-0000-4000-8000-000000000009',
   'pending', 5000, 'cs_test_16_09', null, null,
   null, null, null, null),
  ('26000000-0000-4000-8000-000000000011', '16000000-0000-4000-8000-000000000011',
   'paid', 5000, 'cs_test_16_11', 'pi_test_16_11', now() - interval '3 minutes',
   null, null, null, null);

insert into public.reviews (
  id, reservation_id, space_id, author_id,
  quietness, wifi_reliability, cleanliness, comfort, status
) values
  ('16a00000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   5, 4, 5, 4, 'visible'),
  ('16a00000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   4, 4, 4, 4, 'hidden'),
  ('16a00000-0000-4000-8000-000000000004', '16000000-0000-4000-8000-000000000004',
   'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   3, 3, 3, 3, 'removed');

-- Remove unit S2 after reservation 03 ended (D-052): unit_id goes null, unit_label stays 'S2'
delete from public.units where id = 'f0000000-0000-4000-8000-000000000002';

-- Active pending_payment (seeker3), active occupied (seeker4), and lapsed reserved (seeker5)
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, wait_window_ends_at, booking_token,
  checked_in_at, ended_at, created_at
) values
  ('16000000-0000-4000-8000-000000000012', '16d00000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000017', 'U1',
   'pending_payment', interval '30 minutes', now() + interval '10 minutes', null,
   null, null, null, now() - interval '2 minutes'),
  ('16000000-0000-4000-8000-000000000013', '16d00000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000018', 'U2',
   'occupied', interval '60 minutes', now() - interval '20 minutes', now() + interval '40 minutes',
   'HST000000013', now() - interval '10 minutes', null, now() - interval '25 minutes'),
  ('16000000-0000-4000-8000-000000000014', '16d00000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000019', 'U3',
   'reserved', interval '30 minutes', now() - interval '45 minutes', now() - interval '5 minutes',
   'HST000000014', null, null, now() - interval '50 minutes');

insert into public.payments (
  id, reservation_id, status, fee_amount, checkout_session_id, external_payment_id, paid_at
) values
  ('26000000-0000-4000-8000-000000000012', '16000000-0000-4000-8000-000000000012',
   'pending', 5000, 'cs_test_16_12', null, null),
  ('26000000-0000-4000-8000-000000000013', '16000000-0000-4000-8000-000000000013',
   'paid', 5000, 'cs_test_16_13', 'pi_test_16_13', now() - interval '22 minutes'),
  ('26000000-0000-4000-8000-000000000014', '16000000-0000-4000-8000-000000000014',
   'paid', 5000, 'cs_test_16_14', 'pi_test_16_14', now() - interval '46 minutes');

-- 105 paid, ended holds for seeker6 (Bulk 1 = newest ... Bulk 105 = oldest)
insert into public.reservations (
  seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, ended_at, created_at
)
select
  '16d00000-0000-4000-8000-000000000004',
  'e0000000-0000-4000-8000-000000000001',
  null,
  'Bulk ' || n,
  'completed',
  interval '60 minutes',
  now() - interval '10 days' - n * interval '1 minute',
  now() - interval '10 days' - n * interval '1 minute' + interval '30 minutes',
  now() - interval '10 days' - n * interval '1 minute'
from generate_series(1, 105) as n;

insert into public.payments (
  reservation_id, status, fee_amount, external_payment_id, paid_at
)
select
  r.id,
  'paid',
  5000,
  'pi_test_16_bulk_' || substr(r.unit_label, 6),
  r.payment_window_ends_at
from public.reservations r
where r.seeker_id = '16d00000-0000-4000-8000-000000000004';

-- ---------------------------------------------------------------------------
-- 1. Seeker reads paid, ended reservations newest first, with expected fields
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  array(select reservation_id from public.my_reservation_history()),
  array[
    '16000000-0000-4000-8000-000000000007',
    '16000000-0000-4000-8000-000000000006',
    '16000000-0000-4000-8000-000000000005',
    '16000000-0000-4000-8000-000000000004',
    '16000000-0000-4000-8000-000000000003',
    '16000000-0000-4000-8000-000000000002',
    '16000000-0000-4000-8000-000000000001'
  ]::uuid[],
  'a Seeker reads their paid, ended reservations, newest first'
);

select results_eq(
  $$select reservation_status::text, checked_in_at is not null, ended_at is not null,
      space_id, space_name, space_listed, unit_id, unit_label,
      payment_status::text, fee_amount, refunded_at is not null,
      review_id, review_status::text
    from public.my_reservation_history()
    where reservation_id = '16000000-0000-4000-8000-000000000001'$$,
  $$values (
    'completed', true, true,
    'e0000000-0000-4000-8000-000000000001'::uuid, 'Kapihan Study Hall', true,
    'f0000000-0000-4000-8000-000000000001'::uuid, 'S1',
    'paid', 5000, false,
    null::uuid, null::text
  )$$,
  'a completed visit without a review returns expected Space, unit, payment and null review fields'
);

select results_eq(
  $$select space_listed, review_id, review_status::text
    from public.my_reservation_history()
    where reservation_id = '16000000-0000-4000-8000-000000000002'$$,
  $$values (false, '16a00000-0000-4000-8000-000000000002'::uuid, 'visible')$$,
  'a Space that isn''t Verified reads as not listed, and a visible review is returned'
);

select results_eq(
  $$select unit_id, unit_label, review_id, review_status::text
    from public.my_reservation_history()
    where reservation_id = '16000000-0000-4000-8000-000000000003'$$,
  $$values (null::uuid, 'S2', '16a00000-0000-4000-8000-000000000003'::uuid, 'hidden')$$,
  'a removed unit keeps its label and has no unit id, and a hidden review keeps its status'
);

select results_eq(
  $$select review_id, review_status::text
    from public.my_reservation_history()
    where reservation_id = '16000000-0000-4000-8000-000000000004'$$,
  $$values ('16a00000-0000-4000-8000-000000000004'::uuid, 'removed')$$,
  'a visit shows a removed review''s status'
);

select results_eq(
  $$select reservation_status::text, payment_status::text, refunded_at is not null,
      checked_in_at is not null, review_id, review_status::text
    from public.my_reservation_history()
    where reservation_id = '16000000-0000-4000-8000-000000000005'$$,
  $$values ('cancelled', 'refunded', true, false, null::uuid, null::text)$$,
  'a cancelled hold with a refunded fee returns refunded status and refunded_at'
);

select results_eq(
  $$select reservation_status::text, payment_status::text
    from public.my_reservation_history()
    where reservation_id = '16000000-0000-4000-8000-000000000006'$$,
  $$values ('expired', 'paid')$$,
  'an expired hold paid late (P2) is listed with paid payment status'
);

select results_eq(
  $$select reservation_status::text, payment_status::text
    from public.my_reservation_history()
    where reservation_id = '16000000-0000-4000-8000-000000000007'$$,
  $$values ('no_show', 'forfeited')$$,
  'a recorded no-show is listed with forfeited payment status'
);

select is_empty(
  $$select reservation_id from public.my_reservation_history(100, 0)
    where reservation_id in (
      '16000000-0000-4000-8000-000000000008',
      '16000000-0000-4000-8000-000000000009',
      '16000000-0000-4000-8000-000000000011'
    )$$,
  'an unpaid hold that lapsed or was cancelled isn''t listed, and neither is an active reserved hold'
);

-- ---------------------------------------------------------------------------
-- 2. Other active holds excluded, and lazy lapse recording (D-047)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "16d00000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select reservation_id from public.my_reservation_history()$$,
  'an active pending_payment hold isn''t listed'
);

set local request.jwt.claims =
  '{"sub": "16d00000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is_empty(
  $$select reservation_id from public.my_reservation_history()$$,
  'an active occupied visit isn''t listed'
);

set local request.jwt.claims =
  '{"sub": "16d00000-0000-4000-8000-000000000003", "role": "authenticated"}';

select results_eq(
  $$select reservation_id, reservation_status::text, payment_status::text
    from public.my_reservation_history()$$,
  $$values ('16000000-0000-4000-8000-000000000014'::uuid, 'no_show', 'forfeited')$$,
  'a hold whose wait window lapsed reads as a no-show, with its fee forfeited'
);

set local role postgres;

select results_eq(
  $$select r.status::text, p.status::text
    from public.reservations r
    join public.payments p on p.reservation_id = r.id
    where r.id = '16000000-0000-4000-8000-000000000014'$$,
  $$values ('no_show', 'forfeited')$$,
  'reading my_reservation_history persisted the lapsed no-show and forfeited fee'
);

-- ---------------------------------------------------------------------------
-- 3. Isolation & access control (D-047, AGENTS.md rule 5)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is_empty(
  $$select reservation_id from public.my_reservation_history(100, 0)
    where reservation_id::text like '1600%'$$,
  'another Seeker gets 0 rows of someone else''s history'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select reservation_id from public.my_reservation_history(100, 0)$$,
  'a Host gets 0 rows of someone else''s history'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select reservation_id from public.my_reservation_history(100, 0)$$,
  'an Administrator gets 0 rows of someone else''s history'
);

set local request.jwt.claims = '{}';

select throws_ok(
  $$select * from public.my_reservation_history()$$,
  '42501', null,
  'an authenticated session with no caller id cannot run my_reservation_history'
);

set local role anon;
set local request.jwt.claims = '{}';

select throws_ok(
  $$select * from public.my_reservation_history()$$,
  '42501', null,
  'a signed-out visitor cannot run my_reservation_history'
);

-- ---------------------------------------------------------------------------
-- 4. Paging and clamping (design §2, §4)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "16d00000-0000-4000-8000-000000000004", "role": "authenticated"}';

select is(
  (select count(*)::integer from public.my_reservation_history(500, -5)),
  101,
  'my_reservation_history clamps a page size of 500 to 101, and a negative offset to 0'
);

select results_eq(
  $$select
      (select unit_label from public.my_reservation_history(500, -5) limit 1),
      (select unit_label from public.my_reservation_history(500, -5) offset 100 limit 1)$$,
  $$values ('Bulk 1', 'Bulk 101')$$,
  'clamped page returns newest first starting at offset 0 through row 101'
);

select is(
  array(select unit_label from public.my_reservation_history(0, 0)),
  array['Bulk 1'],
  'page size below 1 clamps to 1'
);

select is(
  (select count(*)::integer from public.my_reservation_history(null, null)),
  20,
  'null page size and offset default to 20 rows from offset 0'
);

select is(
  array(select unit_label from public.my_reservation_history(5, 102)),
  array['Bulk 103', 'Bulk 104', 'Bulk 105'],
  'offset 102 returns the remaining 3 rows in newest-first order'
);

select * from finish();
rollback;
