-- STORY-07, TSK-07.1: zones and units tables, exclusion constraints, grants, RLS, and unit_states.
-- The cases follow the design's §4 matrix (docs/design/STORY-07-seat-map-builder.md).
-- Uses the accounts, spaces, zones and units from supabase/seed.sql:
--   admin  a0000000-0000-4000-8000-000000000001
--   host   b0000000-0000-4000-8000-000000000001  owns e…01 (verified), e…02 (pending)
--   host2  b0000000-0000-4000-8000-000000000002  owns e…03 (verified)
--   seeker c0000000-0000-4000-8000-000000000001
begin;
create extension if not exists pgtap with schema extensions;
select plan(114);

-- ---------------------------------------------------------------------------
-- An anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- Case 2: visitor selects zones and units for a Verified Space (returns all rows)
select results_eq(
  $$select id from public.zones where space_id = 'e0000000-0000-4000-8000-000000000001' order by position$$,
  $$values ('d0000000-0000-4000-8000-000000000001'::uuid),
           ('d0000000-0000-4000-8000-000000000002'::uuid),
           ('d0000000-0000-4000-8000-000000000003'::uuid)$$,
  'an anonymous visitor selects zones for a verified space'
);

select results_eq(
  $$select count(*)::int from public.units where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (14)$$,
  'an anonymous visitor selects all 14 units for a verified space'
);

-- Case 3: visitor selects zones and units for a Pending Space (0 rows, D-055, N19)
select is_empty(
  $$select id from public.zones where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'an anonymous visitor gets 0 zones for a pending space'
);

select is_empty(
  $$select id from public.units where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'an anonymous visitor gets 0 units for a pending space'
);

-- Case 6: visitor selects host_state, host_updated_at, or * from units (42501 refusal)
select throws_ok(
  $$select host_state from public.units$$,
  '42501',
  null,
  'an anonymous visitor cannot select units.host_state directly'
);

select throws_ok(
  $$select host_updated_at from public.units$$,
  '42501',
  null,
  'an anonymous visitor cannot select units.host_updated_at directly'
);

select throws_ok(
  $$select * from public.units$$,
  '42501',
  null,
  'an anonymous visitor cannot select * from units'
);

-- Case 9: visitor inserts a zone or a unit (42501 refusal)
select throws_ok(
  $$insert into public.zones (space_id, name, position)
    values ('e0000000-0000-4000-8000-000000000001', 'Visitor Zone', 0)$$,
  '42501',
  null,
  'an anonymous visitor cannot insert a zone'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'V1', null, 5, 0, 1)$$,
  '42501',
  null,
  'an anonymous visitor cannot insert a unit'
);

-- Case 12: visitor updates or deletes zones or units (42501 refusal)
select throws_ok(
  $$update public.zones set name = 'Anon Edited'
    where id = 'd0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'an anonymous visitor cannot update a zone'
);

select throws_ok(
  $$delete from public.zones
    where id = 'd0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'an anonymous visitor cannot delete a zone'
);

select throws_ok(
  $$update public.units set label = 'Anon'
    where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'an anonymous visitor cannot update a unit'
);

select throws_ok(
  $$delete from public.units
    where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'an anonymous visitor cannot delete a unit'
);

-- Case 23: public.unit_states called by visitor on a Verified Space
select results_eq(
  $$select count(*)::int,
           count(case when seat_state = 'available' then 1 end)::int,
           count(case when wait_window_ends_at is not null then 1 end)::int,
           count(case when reservation_id is not null then 1 end)::int
    from public.unit_states('e0000000-0000-4000-8000-000000000001')$$,
  $$values (14, 14, 0, 0)$$,
  'an anonymous visitor calls unit_states on a verified space: all 14 units available, wait window and reservation null'
);

-- Case 24: unit_states returns 0 rows for a Pending Space to visitor
select is_empty(
  $$select * from public.unit_states('e0000000-0000-4000-8000-000000000002')$$,
  'an anonymous visitor gets 0 rows from unit_states for a pending space'
);

select is_empty(
  $$select * from public.unit_states('00000000-0000-0000-0000-000000000000')$$,
  'unit_states with a non-existent space_id returns 0 rows'
);

select is_empty(
  $$select * from public.unit_states(null)$$,
  'unit_states with null space_id returns 0 rows'
);

-- ---------------------------------------------------------------------------
-- A Seeker
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Case 2: Seeker selects zones and units for a Verified Space (returns all rows)
select results_eq(
  $$select count(*)::int from public.zones where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (3)$$,
  'a Seeker selects zones for a verified space'
);

select results_eq(
  $$select count(*)::int from public.units where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (14)$$,
  'a Seeker selects units for a verified space'
);

-- Case 3: Seeker selects zones and units for a Pending Space (0 rows, D-055, N19)
select is_empty(
  $$select id from public.zones where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'a Seeker gets 0 zones for a pending space'
);

select is_empty(
  $$select id from public.units where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'a Seeker gets 0 units for a pending space'
);

-- Case 6: Seeker selects host_state, host_updated_at, or * from units (42501 refusal)
select throws_ok(
  $$select host_state from public.units$$,
  '42501',
  null,
  'a Seeker cannot select units.host_state directly'
);

select throws_ok(
  $$select host_updated_at from public.units$$,
  '42501',
  null,
  'a Seeker cannot select units.host_updated_at directly'
);

select throws_ok(
  $$select * from public.units$$,
  '42501',
  null,
  'a Seeker cannot select * from units'
);

-- Case 9: Seeker inserts a zone or a unit (42501 refusal)
select throws_ok(
  $$insert into public.zones (space_id, name, position)
    values ('e0000000-0000-4000-8000-000000000001', 'Seeker Zone', 0)$$,
  '42501',
  null,
  'a Seeker cannot insert a zone'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'SK1', null, 5, 0, 1)$$,
  '42501',
  null,
  'a Seeker cannot insert a unit'
);

-- Case 11: Seeker updates or deletes a Host's zones or units (affects 0 rows)
select is_empty(
  $$update public.zones set name = 'Seeker Edited'
    where id = 'd0000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker updating a Host''s zone affects 0 rows'
);

select is_empty(
  $$delete from public.zones
    where id = 'd0000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker deleting a Host''s zone affects 0 rows'
);

select is_empty(
  $$update public.units set label = 'SK'
    where id = 'f0000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker updating a Host''s unit affects 0 rows'
);

select is_empty(
  $$delete from public.units
    where id = 'f0000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker deleting a Host''s unit affects 0 rows'
);

-- Case 23: public.unit_states called by Seeker on a Verified Space
select results_eq(
  $$select count(*)::int,
           count(case when seat_state = 'available' then 1 end)::int,
           count(case when wait_window_ends_at is not null then 1 end)::int,
           count(case when reservation_id is not null then 1 end)::int
    from public.unit_states('e0000000-0000-4000-8000-000000000001')$$,
  $$values (14, 14, 0, 0)$$,
  'a Seeker calls unit_states on a verified space: all 14 units available, wait window and reservation null'
);

-- Case 24: unit_states returns 0 rows for a Pending Space to Seeker
select is_empty(
  $$select * from public.unit_states('e0000000-0000-4000-8000-000000000002')$$,
  'a Seeker gets 0 rows from unit_states for a pending space'
);

-- ---------------------------------------------------------------------------
-- Another Host (Host 2, owns e...03)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

-- Case 4: another Host selects zones and units for a Pending Space (0 rows, D-055, N19)
select is_empty(
  $$select id from public.zones where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'another Host gets 0 zones for the first Host''s pending space'
);

select is_empty(
  $$select id from public.units where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'another Host gets 0 units for the first Host''s pending space'
);

-- Case 8: Host inserts zone or unit targeting another Host's Space (42501 refusal)
select throws_ok(
  $$insert into public.zones (space_id, name, position)
    values ('e0000000-0000-4000-8000-000000000001', 'Host 2 Intrusion', 0)$$,
  '42501',
  null,
  'another Host cannot insert a zone into a Space they do not own'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'H2X', null, 5, 0, 1)$$,
  '42501',
  null,
  'another Host cannot insert a unit into a Space they do not own'
);

-- Case 11: another Host updates or deletes a Host's zones or units (affects 0 rows)
select is_empty(
  $$update public.zones set name = 'Hijacked Zone'
    where id = 'd0000000-0000-4000-8000-000000000001' returning id$$,
  'another Host updating a Host''s zone affects 0 rows'
);

select is_empty(
  $$delete from public.zones
    where id = 'd0000000-0000-4000-8000-000000000001' returning id$$,
  'another Host deleting a Host''s zone affects 0 rows'
);

select is_empty(
  $$update public.units set label = 'H2'
    where id = 'f0000000-0000-4000-8000-000000000001' returning id$$,
  'another Host updating a Host''s unit affects 0 rows'
);

select is_empty(
  $$delete from public.units
    where id = 'f0000000-0000-4000-8000-000000000001' returning id$$,
  'another Host deleting a Host''s unit affects 0 rows'
);

-- Case 24: unit_states returns 0 rows for a Pending Space to another Host
select is_empty(
  $$select * from public.unit_states('e0000000-0000-4000-8000-000000000002')$$,
  'another Host gets 0 rows from unit_states for the first Host''s pending space'
);

select results_eq(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 'seat', 'S1', null, 1, 0, 1)
    returning label$$,
  $$values ('S1')$$,
  'different Spaces may reuse the same unit label'
);

-- ---------------------------------------------------------------------------
-- An Administrator
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Case 5: Administrator selects zones and units for a Pending Space (returns all rows, STORY-15)
select results_eq(
  $$select id from public.zones where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values ('d0000000-0000-4000-8000-000000000004'::uuid)$$,
  'an Administrator lists zones for a pending space'
);

select results_eq(
  $$select count(*)::int from public.units where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values (2)$$,
  'an Administrator lists units for a pending space'
);

-- Case 10: Administrator inserts a zone or a unit (42501 refusal)
select throws_ok(
  $$insert into public.zones (space_id, name, position)
    values ('e0000000-0000-4000-8000-000000000001', 'Admin Zone', 0)$$,
  '42501',
  null,
  'an Administrator cannot insert a zone'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'AD1', null, 5, 0, 1)$$,
  '42501',
  null,
  'an Administrator cannot insert a unit'
);

-- Case 11: Administrator updates or deletes a Host's zones or units (affects 0 rows)
select is_empty(
  $$update public.zones set name = 'Admin Modified'
    where id = 'd0000000-0000-4000-8000-000000000001' returning id$$,
  'an Administrator updating a Host''s zone affects 0 rows'
);

select is_empty(
  $$delete from public.zones
    where id = 'd0000000-0000-4000-8000-000000000001' returning id$$,
  'an Administrator deleting a Host''s zone affects 0 rows'
);

select is_empty(
  $$update public.units set label = 'AD'
    where id = 'f0000000-0000-4000-8000-000000000001' returning id$$,
  'an Administrator updating a Host''s unit affects 0 rows'
);

select is_empty(
  $$delete from public.units
    where id = 'f0000000-0000-4000-8000-000000000001' returning id$$,
  'an Administrator deleting a Host''s unit affects 0 rows'
);

-- Case 24: unit_states returns rows for a Pending Space to an Administrator
select results_eq(
  $$select count(*)::int from public.unit_states('e0000000-0000-4000-8000-000000000002')$$,
  $$values (2)$$,
  'an Administrator reads unit_states for a pending space'
);

-- ---------------------------------------------------------------------------
-- The Space Owner (Host 1, owns e...01 and e...02)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Case 1: Host selects zones and units for their own Space (returns all rows)
select results_eq(
  $$select count(*)::int from public.zones where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (3)$$,
  'a Host selects zones for their own verified space'
);

select results_eq(
  $$select count(*)::int from public.units where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (14)$$,
  'a Host selects units for their own verified space'
);

select results_eq(
  $$select count(*)::int from public.zones where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values (1)$$,
  'a Host selects zones for their own pending space'
);

select results_eq(
  $$select count(*)::int from public.units where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values (2)$$,
  'a Host selects units for their own pending space'
);

-- Case 6: Host cannot select host_state, host_updated_at, or * from units directly (N15)
select throws_ok(
  $$select host_state from public.units$$,
  '42501',
  null,
  'a Host cannot select units.host_state directly'
);

select throws_ok(
  $$select host_updated_at from public.units$$,
  '42501',
  null,
  'a Host cannot select units.host_updated_at directly'
);

select throws_ok(
  $$select * from public.units$$,
  '42501',
  null,
  'a Host cannot select * from units'
);

-- Case 7: Host inserts zone or unit in their own Space (succeeds)
select results_eq(
  $$insert into public.zones (space_id, name, position)
    values ('e0000000-0000-4000-8000-000000000001', 'Host New Zone', 3)
    returning name$$,
  $$values ('Host New Zone')$$,
  'a Host inserts a zone into their own space'
);

select results_eq(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S9', null, 2, 0, 1)
    returning label$$,
  $$values ('S9')$$,
  'a Host inserts a unit into their own space'
);

-- Case 13: Host updates unit label, capacity, or grid coordinates (succeeds)
select results_eq(
  $$update public.units set label = 'S8-Renamed', grid_col = 2
    where id = 'f0000000-0000-4000-8000-000000000008'
    returning label, grid_col$$,
  $$values ('S8-Renamed', 2::smallint)$$,
  'a Host updates unit label and grid coordinates'
);

select results_eq(
  $$update public.units set capacity = 5
    where id = 'f0000000-0000-4000-8000-000000000014'
    returning capacity$$,
  $$values (5::smallint)$$,
  'a Host updates room capacity'
);

select results_eq(
  $$update public.zones set position = 10
    where id = 'd0000000-0000-4000-8000-000000000001'
    returning position$$,
  $$values (10::smallint)$$,
  'a Host updates zone position'
);

-- Case 14: "a new unit reads Available, Host-updated when it was added" (H1)
select results_eq(
  $$select seat_state, (host_updated_at >= now() - interval '1 minute')
    from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = (select id from public.units where label = 'S9')$$,
  $$values ('available'::text, true)$$,
  'a new unit reads Available, Host-updated when it was added (H1)'
);

-- Case 15: A Host's label edit or move leaves the Host-updated time alone (D-051)
create temp table before_host_update as
  select host_updated_at
  from public.unit_states('e0000000-0000-4000-8000-000000000001')
  where unit_id = 'f0000000-0000-4000-8000-000000000008';

update public.units set label = 'S8-Relabeled'
where id = 'f0000000-0000-4000-8000-000000000008';

select results_eq(
  $$select host_updated_at
    from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000008'$$,
  $$select host_updated_at from before_host_update$$,
  'a Host''s label edit leaves the Host-updated time alone (D-051)'
);

update public.units set grid_col = 3
where id = 'f0000000-0000-4000-8000-000000000008';

select results_eq(
  $$select host_updated_at
    from public.unit_states('e0000000-0000-4000-8000-000000000001')
    where unit_id = 'f0000000-0000-4000-8000-000000000008'$$,
  $$select host_updated_at from before_host_update$$,
  'a Host''s move leaves the Host-updated time alone (D-051)'
);

-- Case 16: "a Host cannot write a unit's state or Host-updated time directly" (N15)
select throws_ok(
  $$update public.units set host_state = 'occupied'
    where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Host cannot write a unit''s state directly (N15)'
);

select throws_ok(
  $$update public.units set host_updated_at = now()
    where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Host cannot write a unit''s host_updated_at directly (N15)'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, host_state)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'SX', 'occupied')$$,
  '42501',
  null,
  'a Host cannot insert custom host_state directly'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, host_updated_at)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'SY', now())$$,
  '42501',
  null,
  'a Host cannot insert custom host_updated_at directly'
);

-- Case 17: Host attempts direct update of space_id, on a unit or a zone (42501 refusal)
select throws_ok(
  $$update public.zones set space_id = 'e0000000-0000-4000-8000-000000000003'
    where id = 'd0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Host cannot update space_id on a zone'
);

select throws_ok(
  $$update public.units set space_id = 'e0000000-0000-4000-8000-000000000003'
    where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Host cannot update space_id on a unit'
);

-- Case 18: Overlapping unit insertion in same zone and row (23P01 exclusion violation)
select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S-Overlap', null, 0, 0, 1)$$,
  '23P01',
  null,
  'overlapping seat insertion raises 23P01 exclusion violation'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'seat', 'S-Over-Room', null, 0, 1, 1)$$,
  '23P01',
  null,
  'seat overlapping a multi-cell room raises 23P01 exclusion violation'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'room', 'Room-Overlap', 4, 0, 2, 2)$$,
  '23P01',
  null,
  'room overlapping existing room raises 23P01 exclusion violation'
);

select throws_ok(
  $$update public.units set grid_row = 0, grid_col = 0
    where id = 'f0000000-0000-4000-8000-000000000008'$$,
  '23P01',
  null,
  'moving a unit to an occupied cell raises 23P01 exclusion violation'
);

-- Case 19: Duplicate unit label within the same Space (23505 unique constraint violation)
select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 's1', null, 3, 0, 1)$$,
  '23505',
  null,
  'duplicate unit label in same Space (case-insensitive) raises 23505'
);

select throws_ok(
  $$update public.units set label = 's1'
    where id = 'f0000000-0000-4000-8000-000000000002'$$,
  '23505',
  null,
  'updating unit label to a duplicate in same Space (case-insensitive) raises 23505'
);

select throws_ok(
  $$insert into public.zones (space_id, name, position)
    values ('e0000000-0000-4000-8000-000000000001', 'quiet desks', 5)$$,
  '23505',
  null,
  'duplicate zone name in same Space (case-insensitive) raises 23505'
);

-- Case 20: Check constraint violations (23514)
select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'room', 'R-NullCap', null, 3, 0, 2)$$,
  '23514',
  null,
  'whole room with null capacity raises 23514'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S-HasCap', 2, 3, 0, 1)$$,
  '23514',
  null,
  'seat with non-null capacity raises 23514'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S-Wide', null, 3, 0, 2)$$,
  '23514',
  null,
  'seat 2 cells wide raises 23514'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'standing_desk', 'D-HasCap', 1, 3, 0, 1)$$,
  '23514',
  null,
  'standing desk with non-null capacity raises 23514'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'standing_desk', 'D-Wide', null, 3, 0, 2)$$,
  '23514',
  null,
  'standing desk with col_span > 1 raises 23514'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'room', 'R-Span1', 4, 3, 0, 1)$$,
  '23514',
  null,
  'room with col_span = 1 raises 23514'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'room', 'R-ZeroCap', 0, 3, 0, 2)$$,
  '23514',
  null,
  'room with capacity = 0 raises 23514'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'room', 'R-OverCap', 51, 3, 0, 2)$$,
  '23514',
  null,
  'room with capacity > 50 raises 23514'
);

select throws_ok(
  $$insert into public.zones (space_id, name, position)
    values ('e0000000-0000-4000-8000-000000000001', 'Negative Position', -1)$$,
  '23514',
  null,
  'zone with negative position raises 23514'
);

select throws_ok(
  $$insert into public.zones (space_id, name, position)
    values ('e0000000-0000-4000-8000-000000000001', '   ', 1)$$,
  '23514',
  null,
  'zone with whitespace-only name raises 23514'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', '   ', null, 3, 0, 1)$$,
  '23514',
  null,
  'unit with whitespace-only label raises 23514'
);

-- Case 21: Unit with grid_col + col_span > 6 (23514)
select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'room', 'R-OutOfBounds', 4, 3, 5, 2)$$,
  '23514',
  null,
  'unit with grid_col + col_span > 6 raises 23514'
);

-- Case 22: Unit referencing a zone belonging to a different Space, on a free cell (23503 foreign key violation)
select throws_ok(
  $$update public.units set zone_id = 'd0000000-0000-4000-8000-000000000005', grid_row = 5, grid_col = 0
    where id = 'f0000000-0000-4000-8000-000000000007'$$,
  '23503',
  null,
  'unit referencing a zone belonging to a different Space raises 23503'
);

select throws_ok(
  $$insert into public.units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'seat', 'SX-FK', null, 5, 0, 1)$$,
  '23503',
  null,
  'inserting unit with another space''s zone raises 23503'
);

select results_eq(
  $$delete from public.units where id = 'f0000000-0000-4000-8000-000000000001' returning label$$,
  $$values ('S1')$$,
  'a Host deletes a unit from their own space'
);

select results_eq(
  $$insert into public.zones (space_id, name, position)
    values ('e0000000-0000-4000-8000-000000000001', 'Ephemeral Zone', 99)
    returning name$$,
  $$values ('Ephemeral Zone')$$,
  'a Host creates an ephemeral zone'
);

select results_eq(
  $$insert into public.units (space_id, zone_id, unit_type, label, grid_row, grid_col, col_span)
    values ('e0000000-0000-4000-8000-000000000001',
            (select id from public.zones where name = 'Ephemeral Zone'),
            'seat', 'EZ1', 0, 0, 1)
    returning label$$,
  $$values ('EZ1')$$,
  'a Host creates a unit in the ephemeral zone'
);

select results_eq(
  $$delete from public.zones where name = 'Ephemeral Zone' returning name$$,
  $$values ('Ephemeral Zone')$$,
  'a Host deletes the ephemeral zone'
);

select is_empty(
  $$select id from public.units where label = 'EZ1'$$,
  'deleting a zone cascades to its units'
);

-- Case 24: unit_states returns rows for a Pending Space to its Host
select results_eq(
  $$select count(*)::int from public.unit_states('e0000000-0000-4000-8000-000000000002')$$,
  $$values (2)$$,
  'unit_states returns rows for a Pending Space to its Host (N19)'
);

-- ---------------------------------------------------------------------------
-- Rejected Space verification for Case 24
-- ---------------------------------------------------------------------------
reset role;

insert into public.spaces (id, host_id, name, description, address, opens_at, closes_at, status)
values ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001',
        'Kapihan Rejected Annex', 'Rejected description', 'Rejected address', '08:00', '17:00', 'rejected');

insert into public.zones (id, space_id, name, position)
values ('d0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000004', 'Rejected Zone', 0);

insert into public.units (id, space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
values ('f0000000-0000-4000-8000-000000000020', 'e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000006', 'seat', 'RJ1', null, 0, 0, 1);

-- Visitor gets 0 rows for rejected space
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is_empty(
  $$select id from public.zones where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  'an anonymous visitor gets 0 zones for a rejected space'
);

select is_empty(
  $$select id from public.units where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  'an anonymous visitor gets 0 units for a rejected space'
);

select is_empty(
  $$select * from public.unit_states('e0000000-0000-4000-8000-000000000004')$$,
  'an anonymous visitor gets 0 rows from unit_states for a rejected space'
);

-- Seeker gets 0 rows for rejected space
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select is_empty(
  $$select id from public.zones where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  'a Seeker gets 0 zones for a rejected space'
);

select is_empty(
  $$select id from public.units where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  'a Seeker gets 0 units for a rejected space'
);

select is_empty(
  $$select * from public.unit_states('e0000000-0000-4000-8000-000000000004')$$,
  'a Seeker gets 0 rows from unit_states for a rejected space'
);

-- Another Host gets 0 rows for rejected space
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select is_empty(
  $$select id from public.zones where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  'another Host gets 0 zones for a rejected space'
);

select is_empty(
  $$select id from public.units where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  'another Host gets 0 units for a rejected space'
);

select is_empty(
  $$select * from public.unit_states('e0000000-0000-4000-8000-000000000004')$$,
  'another Host gets 0 rows from unit_states for a rejected space'
);

-- Space Host gets rows for their own rejected space
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select results_eq(
  $$select count(*)::int from public.zones where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  $$values (1)$$,
  'a Host lists zones for their own rejected space'
);

select results_eq(
  $$select count(*)::int from public.units where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  $$values (1)$$,
  'a Host lists units for their own rejected space'
);

select results_eq(
  $$select count(*)::int from public.unit_states('e0000000-0000-4000-8000-000000000004')$$,
  $$values (1)$$,
  'a Host reads unit_states for their own rejected space'
);

-- Administrator gets rows for rejected space
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select results_eq(
  $$select count(*)::int from public.zones where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  $$values (1)$$,
  'an Administrator lists zones for a rejected space'
);

select results_eq(
  $$select count(*)::int from public.units where space_id = 'e0000000-0000-4000-8000-000000000004'$$,
  $$values (1)$$,
  'an Administrator lists units for a rejected space'
);

select results_eq(
  $$select count(*)::int from public.unit_states('e0000000-0000-4000-8000-000000000004')$$,
  $$values (1)$$,
  'an Administrator reads unit_states for a rejected space'
);

select * from finish();
rollback;
