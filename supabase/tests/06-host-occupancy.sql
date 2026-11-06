-- STORY-12, TSK-12.1: Host occupancy state control and public.set_unit_state.
-- The cases follow the design's §4 matrix (docs/design/STORY-12-host-occupancy.md)
-- and the reservation lifecycle flow (docs/flows/reservation-lifecycle.md).
-- Uses accounts, spaces, zones and units from supabase/seed.sql:
--   admin  a0000000-0000-4000-8000-000000000001
--   host   b0000000-0000-4000-8000-000000000001  owns e…01 (verified), e…02 (pending)
--   host2  b0000000-0000-4000-8000-000000000002  owns e…03 (verified)
--   seeker c0000000-0000-4000-8000-000000000001

begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

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

select * from finish();
rollback;
