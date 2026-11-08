-- STORY-12, TSK-12.1 and TSK-12.4: Host occupancy state control and public.set_unit_state,
-- Host-set states (sections 1 to 11) and hold overrides (sections 12 to 18).
-- The cases follow the design's §4 matrix (docs/design/STORY-12-host-occupancy.md)
-- and the reservation lifecycle flow (docs/flows/reservation-lifecycle.md).
-- Uses accounts, spaces, zones and units from supabase/seed.sql:
--   admin   a0000000-0000-4000-8000-000000000001
--   host    b0000000-0000-4000-8000-000000000001  owns e…01 (verified), e…02 (pending)
--   host2   b0000000-0000-4000-8000-000000000002  owns e…03 (verified)
--   seeker  c0000000-0000-4000-8000-000000000001
--   seeker2 c0000000-0000-4000-8000-000000000002

begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

-- ---------------------------------------------------------------------------
-- 1. An anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'occupied')$$,
  '42501',
  null,
  'a signed-out visitor cannot call set_unit_state (Negative N24)'
);

select throws_ok(
  $$update public.units set host_state = 'occupied' where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a signed-out visitor cannot update units.host_state directly (Negative N15)'
);

select throws_ok(
  $$update public.units set host_updated_at = now() where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a signed-out visitor cannot update units.host_updated_at directly (Negative N15)'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid) where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('available'::text)$$,
  'unit remains available after anonymous visitor rejected attempts'
);

-- ---------------------------------------------------------------------------
-- 2. A Seeker
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'occupied')$$,
  '42501',
  null,
  'a Seeker cannot call set_unit_state on a unit (Negative N13 / N24)'
);

select throws_ok(
  $$update public.units set host_state = 'occupied' where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Seeker cannot update units.host_state directly (Negative N15)'
);

select throws_ok(
  $$update public.units set host_updated_at = now() where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Seeker cannot update units.host_updated_at directly (Negative N15)'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid) where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('available'::text)$$,
  'unit remains available after Seeker rejected attempts (Negative N13 / N24)'
);

-- ---------------------------------------------------------------------------
-- 3. Another Host (host2, who does not own unit f...01)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'occupied')$$,
  '42501',
  null,
  'a Host cannot change another Host''s unit (Negative N13)'
);

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'reserved')$$,
  '42501',
  null,
  'a Host cannot change another Host''s unit to reserved (Negative N13)'
);

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'available')$$,
  '42501',
  null,
  'a Host cannot change another Host''s unit to available (Negative N13)'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid) where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('available'::text)$$,
  'unit remains available after another Host rejected attempts (Negative N13)'
);

-- ---------------------------------------------------------------------------
-- 4. An Administrator (who does not own the Space)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'occupied')$$,
  '42501',
  null,
  'an Administrator cannot change a Host''s unit (Negative N13)'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid) where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('available'::text)$$,
  'unit remains available after Administrator rejected attempts (Negative N13)'
);

-- ---------------------------------------------------------------------------
-- 5. The Space''s Host (host) - direct write denials & validation refusals
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$update public.units set host_state = 'occupied' where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Host cannot update units.host_state directly (Negative N15)'
);

select throws_ok(
  $$update public.units set host_updated_at = now() where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Host cannot update units.host_updated_at directly (Negative N15)'
);

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000999'::uuid, 'occupied')$$,
  '42501',
  null,
  'a Host cannot update a nonexistent unit (Negative N13)'
);

select throws_ok(
  $$select public.set_unit_state(null, 'occupied')$$,
  '42501',
  null,
  'a Host cannot update with null unit_id (Negative N13)'
);

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'pending_payment')$$,
  '23514',
  null,
  'a Host cannot set a unit to Pending Payment (Negative N12)'
);

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'invalid_status')$$,
  '23514',
  null,
  'a Host cannot set a unit to an invalid state'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid) where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('available'::text)$$,
  'unit remains available after rejected attempts'
);

-- ---------------------------------------------------------------------------
-- 6. Move H2: Host sets unit state to occupied
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'occupied')$$,
  'a Host sets their unit state to occupied (Move H2)'
);

select results_eq(
  $$select seat_state, (host_updated_at >= now() - interval '1 minute')
    from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid)
    where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('occupied'::text, true)$$,
  'a Host sets their unit''s state, and the Host-updated time moves (Move H2)'
);

-- ---------------------------------------------------------------------------
-- 7. Move H2: 4-argument call signature with explicit null expected hold parameters
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'occupied', null::uuid, null::text)$$,
  'a Host sets their unit state passing explicit null expected hold parameters (Move H2)'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid)
    where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('occupied'::text)$$,
  'unit remains occupied after 4-argument call'
);

-- ---------------------------------------------------------------------------
-- 8. Visitor reads unit_states after Host state change
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$select seat_state, (host_updated_at >= now() - interval '1 minute')
    from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid)
    where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('occupied'::text, true)$$,
  'a signed-out visitor reads updated state and host_updated_at within one read'
);

-- ---------------------------------------------------------------------------
-- 9. Move H2: Host transitions unit state to reserved and available
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'reserved')$$,
  'a Host sets their unit state to reserved (Move H2)'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid)
    where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('reserved'::text)$$,
  'unit reads reserved (Move H2)'
);

select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'available')$$,
  'a Host sets their unit state back to available (Move H2)'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid)
    where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('available'::text)$$,
  'unit reads available (Move H2)'
);

-- ---------------------------------------------------------------------------
-- 10. Move H2: Same-state tap re-vouches for current occupancy (D-051)
-- ---------------------------------------------------------------------------
-- Set host_updated_at to 1 hour ago as postgres to genuinely verify the tap refreshes it
set local role postgres;
update public.units
set host_updated_at = now() - interval '1 hour'
where id = 'f0000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select (host_updated_at < now() - interval '30 minutes')
    from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid)
    where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values (true)$$,
  'host_updated_at is older before same-state tap'
);

select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000001'::uuid, 'available')$$,
  'a Host taps the currently active state (same-state tap, Move H2)'
);

select results_eq(
  $$select seat_state, (host_updated_at >= now() - interval '1 minute')
    from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid)
    where unit_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('available'::text, true)$$,
  'same-state tap keeps state and refreshes host_updated_at (D-051)'
);

-- ---------------------------------------------------------------------------
-- 11. Move H2: Host sets unit state on a pending Space
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000015'::uuid, 'occupied')$$,
  'a Host sets unit state on their pending space (Move H2)'
);

select results_eq(
  $$select seat_state from public.unit_states('e0000000-0000-4000-8000-000000000002'::uuid)
    where unit_id = 'f0000000-0000-4000-8000-000000000015'$$,
  $$values ('occupied'::text)$$,
  'pending space unit reads occupied to its Host'
);

-- ---------------------------------------------------------------------------
-- 12. Hold overrides (TSK-12.4): set-up, as postgres
-- ---------------------------------------------------------------------------
set local role postgres;

-- pgTAP's throws_ok sees an error's code and message, but not its hint, and the Server
-- Action tells N14 from N21 by the hint (design §2). This runs a statement as the
-- current role and returns '<code> <hint>' for the error it raises.
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

-- One row per hold: its status, whether it has ended, its payment's status, and its
-- unit's Host-set state and Host-updated time. Read as postgres, because nobody else may
-- read reservations or payments (N6).
create temp view override_check as
select
  r.id as reservation_id,
  r.status::text as hold_status,
  r.ended_at is not null as ended,
  p.status::text as payment_status,
  u.host_state,
  case u.host_updated_at
    when now() then 'now'
    when now() - interval '1 hour' then 'an hour ago'
    else 'some other time'
  end as host_updated
from public.reservations r
join public.payments p on p.reservation_id = r.id
join public.units u on u.id = r.unit_id;

-- An hour-old Host-updated time on the units under test, so each check can tell whether
-- a call moved it (D-051). now() stays the same for the whole transaction.
update public.units
set host_updated_at = now() - interval '1 hour'
where id in (
  'f0000000-0000-4000-8000-000000000002',
  'f0000000-0000-4000-8000-000000000003',
  'f0000000-0000-4000-8000-000000000004',
  'f0000000-0000-4000-8000-000000000005'
);

-- Hold 11: the Seeker's unpaid hold on S4 (f…04)
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at
) values (
  '10000000-0000-4000-8000-000000000011',
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
  '20000000-0000-4000-8000-000000000011',
  '10000000-0000-4000-8000-000000000011',
  'pending',
  5000,
  'cs_test_occupancy_11',
  'https://paymongo.test/checkout/cs_test_occupancy_11'
);

-- ---------------------------------------------------------------------------
-- 13. Only the Space's Host may override a hold (N13, N24)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000004'::uuid, 'available',
    '10000000-0000-4000-8000-000000000011'::uuid, 'pending_payment')$$,
  '42501',
  null,
  'a Host cannot override a hold on another Host''s unit, even naming it (Negative N13)'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000004'::uuid, 'available',
    '10000000-0000-4000-8000-000000000011'::uuid, 'pending_payment')$$,
  '42501',
  null,
  'an Administrator cannot override a Host''s hold (Negative N13)'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000004'::uuid, 'available',
    '10000000-0000-4000-8000-000000000011'::uuid, 'pending_payment')$$,
  '42501',
  null,
  'a Seeker cannot end their own hold through set_unit_state (Negative N13 / N24)'
);

set local role postgres;

select results_eq(
  $$select hold_status, ended, payment_status, host_state, host_updated
    from override_check where reservation_id = '10000000-0000-4000-8000-000000000011'$$,
  $$values ('pending_payment'::text, false, 'pending'::text, 'available'::text, 'an hour ago'::text)$$,
  'another Host, an Administrator and a Seeker change neither the hold, its payment nor the unit'
);

-- ---------------------------------------------------------------------------
-- 14. A tap that doesn't name the hold exactly changes nothing (N14, N21, N12)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.set_unit_state('f0000000-0000-4000-8000-000000000004'::uuid, 'occupied')$$),
  'P0001 hold_not_named',
  'a Host''s tap on a held unit changes nothing unless it names the hold (Negative N14)'
);

select is(
  pg_temp.refusal($$select public.set_unit_state('f0000000-0000-4000-8000-000000000004'::uuid, 'occupied',
    '10000000-0000-4000-8000-000000000099'::uuid, 'pending_payment')$$),
  'P0001 hold_changed',
  'a Host''s override naming another reservation is refused (Negative N21)'
);

select is(
  pg_temp.refusal($$select public.set_unit_state('f0000000-0000-4000-8000-000000000004'::uuid, 'occupied',
    '10000000-0000-4000-8000-000000000011'::uuid, null)$$),
  'P0001 hold_changed',
  'a Host''s override naming the hold without its status is refused (Negative N21)'
);

select throws_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000004'::uuid, 'pending_payment',
    '10000000-0000-4000-8000-000000000011'::uuid, 'pending_payment')$$,
  '23514',
  null,
  'a Host cannot set a held unit to Pending Payment, even naming the hold (Negative N12)'
);

set local role postgres;

select results_eq(
  $$select hold_status, ended, payment_status, host_state, host_updated
    from override_check where reservation_id = '10000000-0000-4000-8000-000000000011'$$,
  $$values ('pending_payment'::text, false, 'pending'::text, 'available'::text, 'an hour ago'::text)$$,
  'a refused tap or override leaves the hold, its payment and the unit as they were (Negative N12, N14, N21)'
);

-- ---------------------------------------------------------------------------
-- 15. Move R5: the Host overrides an unpaid hold
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000004'::uuid, 'occupied',
    '10000000-0000-4000-8000-000000000011'::uuid, 'pending_payment')$$,
  'a Host overrides an unpaid hold, naming the hold they saw (Move R5)'
);

set local role postgres;

select results_eq(
  $$select hold_status, ended, payment_status, host_state, host_updated
    from override_check where reservation_id = '10000000-0000-4000-8000-000000000011'$$,
  $$values ('cancelled'::text, true, 'pending'::text, 'occupied'::text, 'now'::text)$$,
  'a Host''s override cancels an unpaid hold'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select seat_state, reservation_id from public.unit_states('e0000000-0000-4000-8000-000000000001'::uuid)
    where unit_id = 'f0000000-0000-4000-8000-000000000004'$$,
  $$values ('occupied'::text, null::uuid)$$,
  'after an override the unit reads the state the Host chose, with no hold (Move R5, H2)'
);

-- A second tab sends the same override after the first ended the hold.
select is(
  pg_temp.refusal($$select public.set_unit_state('f0000000-0000-4000-8000-000000000004'::uuid, 'available',
    '10000000-0000-4000-8000-000000000011'::uuid, 'pending_payment')$$),
  'P0001 hold_changed',
  'an override sent again after its hold has ended is refused (Negative N21)'
);

-- ---------------------------------------------------------------------------
-- 16. Move R9: the Host overrides a paid hold
-- ---------------------------------------------------------------------------
set local role postgres;

-- Hold 12: the Seeker's paid hold on S2 (f…02). The Seeker's hold 11 has ended, so they
-- may hold again (D-008).
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at,
  wait_window_ends_at, booking_token
) values (
  '10000000-0000-4000-8000-000000000012',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002',
  'S2',
  'reserved',
  interval '60 minutes',
  now() + interval '5 minutes',
  now() + interval '65 minutes',
  'HSTB23456789'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '20000000-0000-4000-8000-000000000012',
  '10000000-0000-4000-8000-000000000012',
  'paid',
  5000,
  'pay_test_occupancy_12',
  now()
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- The Host's page loaded while the hold was unpaid, and the Seeker paid before the tap.
select is(
  pg_temp.refusal($$select public.set_unit_state('f0000000-0000-4000-8000-000000000002'::uuid, 'available',
    '10000000-0000-4000-8000-000000000012'::uuid, 'pending_payment')$$),
  'P0001 hold_changed',
  'a Host''s override is refused once the hold has changed (Negative N21)'
);

set local role postgres;

select results_eq(
  $$select hold_status, ended, payment_status, host_state, host_updated
    from override_check where reservation_id = '10000000-0000-4000-8000-000000000012'$$,
  $$values ('reserved'::text, false, 'paid'::text, 'available'::text, 'an hour ago'::text)$$,
  'a refused override leaves a paid hold reserved, its fee paid and the unit as it was (Negative N21)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000002'::uuid, 'available',
    '10000000-0000-4000-8000-000000000012'::uuid, 'reserved')$$,
  'a Host overrides a paid hold, naming the hold they saw (Move R9)'
);

set local role postgres;

select results_eq(
  $$select hold_status, ended, payment_status, host_state, host_updated
    from override_check where reservation_id = '10000000-0000-4000-8000-000000000012'$$,
  $$values ('cancelled'::text, true, 'paid'::text, 'available'::text, 'now'::text)$$,
  'a Host''s override cancels a paid hold and leaves the fee paid'
);

-- ---------------------------------------------------------------------------
-- 17. Move R11: the Host ends a visit
-- ---------------------------------------------------------------------------
-- Hold 13: Seeker 2's visit on S3 (f…03), checked in five minutes ago.
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at,
  wait_window_ends_at, booking_token, checked_in_at
) values (
  '10000000-0000-4000-8000-000000000013',
  'c0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000003',
  'S3',
  'occupied',
  interval '60 minutes',
  now() + interval '5 minutes',
  now() + interval '65 minutes',
  'HSTC23456789',
  now() - interval '5 minutes'
);

insert into public.payments (
  id, reservation_id, status, fee_amount, external_payment_id, paid_at
) values (
  '20000000-0000-4000-8000-000000000013',
  '10000000-0000-4000-8000-000000000013',
  'paid',
  5000,
  'pay_test_occupancy_13',
  now()
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- The Host's page loaded before the check-in.
select is(
  pg_temp.refusal($$select public.set_unit_state('f0000000-0000-4000-8000-000000000003'::uuid, 'available',
    '10000000-0000-4000-8000-000000000013'::uuid, 'reserved')$$),
  'P0001 hold_changed',
  'a Host''s override is refused once the visit has begun (Negative N21)'
);

set local role postgres;

select results_eq(
  $$select hold_status, ended, payment_status, host_state, host_updated
    from override_check where reservation_id = '10000000-0000-4000-8000-000000000013'$$,
  $$values ('occupied'::text, false, 'paid'::text, 'available'::text, 'an hour ago'::text)$$,
  'a refused override leaves the visit going and the unit as it was (Negative N21)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000003'::uuid, 'available',
    '10000000-0000-4000-8000-000000000013'::uuid, 'occupied')$$,
  'a Host ends a visit, naming the hold they saw (Move R11)'
);

set local role postgres;

select results_eq(
  $$select hold_status, ended, payment_status, host_state, host_updated
    from override_check where reservation_id = '10000000-0000-4000-8000-000000000013'$$,
  $$values ('completed'::text, true, 'paid'::text, 'available'::text, 'now'::text)$$,
  'a Host''s override on an occupied unit completes the visit'
);

-- ---------------------------------------------------------------------------
-- 18. The lapse step runs first (D-047)
-- ---------------------------------------------------------------------------
-- Hold 14: the Seeker's unpaid hold on S5 (f…05), whose payment window lapsed a minute
-- ago. Nothing has read the unit since, so the lapse isn't recorded yet.
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at
) values (
  '10000000-0000-4000-8000-000000000014',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000005',
  'S5',
  'pending_payment',
  interval '60 minutes',
  now() - interval '1 minute'
);

insert into public.payments (
  id, reservation_id, status, fee_amount
) values (
  '20000000-0000-4000-8000-000000000014',
  '10000000-0000-4000-8000-000000000014',
  'pending',
  5000
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.set_unit_state('f0000000-0000-4000-8000-000000000005'::uuid, 'occupied',
    '10000000-0000-4000-8000-000000000014'::uuid, 'pending_payment')$$),
  'P0001 hold_changed',
  'a Host''s override is refused once the hold has lapsed (Negative N21)'
);

set local role postgres;

select results_eq(
  $$select host_state, host_updated
    from override_check where reservation_id = '10000000-0000-4000-8000-000000000014'$$,
  $$values ('available'::text, 'an hour ago'::text)$$,
  'a refused override on a lapsed hold leaves the unit as it was (Negative N21)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.set_unit_state('f0000000-0000-4000-8000-000000000005'::uuid, 'occupied')$$,
  'a Host''s plain tap on a unit whose hold has lapsed sets its state (Move H2, D-047)'
);

set local role postgres;

select results_eq(
  $$select hold_status, ended, payment_status, host_state, host_updated
    from override_check where reservation_id = '10000000-0000-4000-8000-000000000014'$$,
  $$values ('expired'::text, true, 'pending'::text, 'occupied'::text, 'now'::text)$$,
  'set_unit_state records the lapse first, so the hold ends expired, not cancelled (Move R3, D-047)'
);

select * from finish();
rollback;
