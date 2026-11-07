-- STORY-08, TSK-08.1: coordinates, price_tier, curated and custom tags, RLS policies, grants.
-- Design: docs/design/STORY-08-geo-discovery.md (§4 test matrix).
-- Uses accounts and spaces from supabase/seed.sql:
--   admin  a0000000-0000-4000-8000-000000000001
--   host   b0000000-0000-4000-8000-000000000001  owns e…01 (verified), e…02 (pending)
--   host2  b0000000-0000-4000-8000-000000000002  owns e…03 (verified)
--   seeker c0000000-0000-4000-8000-000000000001

begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- Pre-seed test curated and custom tags as postgres (bypassing RLS)
insert into public.space_curated_tags (space_id, tag_id)
values
  ('e0000000-0000-4000-8000-000000000001', 'wifi_fast'),
  ('e0000000-0000-4000-8000-000000000001', 'outlets_all'),
  ('e0000000-0000-4000-8000-000000000002', 'noise_silent'),
  ('e0000000-0000-4000-8000-000000000003', 'ac_full');

insert into public.space_custom_tags (id, space_id, name)
values
  ('c0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001', 'Ergonomic Chairs'),
  ('c0000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000002', 'Night Owl Friendly'),
  ('c0000000-0000-4000-8000-000000000013', 'e0000000-0000-4000-8000-000000000003', 'Free Water');

-- ---------------------------------------------------------------------------
-- 1. Anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- Curated tags table is publicly readable
select results_eq(
  $$select count(*)::int from public.curated_tags$$,
  $$values (10)$$,
  'an anonymous visitor can read all 10 curated tags'
);

-- Anon cannot mutate curated_tags catalog
select throws_ok(
  $$insert into public.curated_tags (id, category, label) values ('test_tag', 'wifi', 'Test Tag')$$,
  '42501',
  null,
  'an anonymous visitor cannot insert into curated_tags'
);

select throws_ok(
  $$update public.curated_tags set label = 'Changed' where id = 'wifi_basic'$$,
  '42501',
  null,
  'an anonymous visitor cannot update curated_tags'
);

select throws_ok(
  $$delete from public.curated_tags where id = 'wifi_basic'$$,
  '42501',
  null,
  'an anonymous visitor cannot delete from curated_tags'
);

-- Anon can read curated tags of a verified space
select results_eq(
  $$select tag_id from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000001' order by tag_id$$,
  $$values ('outlets_all'::text), ('wifi_fast'::text)$$,
  'an anonymous visitor can read curated tags of a verified space'
);

-- Anon gets 0 rows for curated tags of a pending space
select is_empty(
  $$select tag_id from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'an anonymous visitor gets 0 curated tags for a pending space'
);

-- Anon cannot insert into space_curated_tags
select throws_ok(
  $$insert into public.space_curated_tags (space_id, tag_id) values ('e0000000-0000-4000-8000-000000000001', 'ac_full')$$,
  '42501',
  null,
  'an anonymous visitor cannot insert into space_curated_tags'
);

-- Anon can read custom tags of a verified space
select results_eq(
  $$select name from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values ('Ergonomic Chairs'::text)$$,
  'an anonymous visitor can read custom tags of a verified space'
);

-- Anon gets 0 rows for custom tags of a pending space
select is_empty(
  $$select name from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'an anonymous visitor gets 0 custom tags for a pending space'
);

-- Anon cannot insert into space_custom_tags
select throws_ok(
  $$insert into public.space_custom_tags (space_id, name) values ('e0000000-0000-4000-8000-000000000001', 'Quiet Zone')$$,
  '42501',
  null,
  'an anonymous visitor cannot insert into space_custom_tags'
);

-- ---------------------------------------------------------------------------
-- 2. Seeker
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select count(*)::int from public.curated_tags$$,
  $$values (10)$$,
  'a seeker can read curated tags'
);

select throws_ok(
  $$insert into public.curated_tags (id, category, label) values ('seeker_tag', 'wifi', 'Seeker Tag')$$,
  '42501',
  null,
  'a seeker cannot insert into curated_tags'
);

select results_eq(
  $$select tag_id from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000001' order by tag_id$$,
  $$values ('outlets_all'::text), ('wifi_fast'::text)$$,
  'a seeker can read curated tags of a verified space'
);

select is_empty(
  $$select tag_id from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'a seeker gets 0 curated tags for a pending space'
);

select throws_ok(
  $$insert into public.space_curated_tags (space_id, tag_id) values ('e0000000-0000-4000-8000-000000000001', 'ac_full')$$,
  '44000',
  null,
  'a seeker cannot insert into space_curated_tags (violates RLS check)'
);

-- Seeker cannot delete from space_curated_tags (0 rows affected)
delete from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000001';
select results_eq(
  $$select count(*)::int from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (2)$$,
  'a seeker cannot delete from space_curated_tags'
);

select results_eq(
  $$select name from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values ('Ergonomic Chairs'::text)$$,
  'a seeker can read custom tags of a verified space'
);

select is_empty(
  $$select name from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'a seeker gets 0 custom tags for a pending space'
);

select throws_ok(
  $$insert into public.space_custom_tags (space_id, name) values ('e0000000-0000-4000-8000-000000000001', 'Nice View')$$,
  '44000',
  null,
  'a seeker cannot insert into space_custom_tags (violates RLS check)'
);

delete from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000001';
select results_eq(
  $$select count(*)::int from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (1)$$,
  'a seeker cannot delete from space_custom_tags'
);

-- ---------------------------------------------------------------------------
-- 3. Host (b...01 - owns e...01 verified and e...02 pending)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Host can update coordinates and price_tier on own verified space
update public.spaces
set latitude = 10.3157, longitude = 123.8854, price_tier = 'standard'
where id = 'e0000000-0000-4000-8000-000000000001';

select results_eq(
  $$select latitude, longitude, price_tier from public.spaces where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (10.3157::double precision, 123.8854::double precision, 'standard'::public.price_tier)$$,
  'a host can update coordinates and price_tier on their own verified space'
);

-- Host can update coordinates and price_tier on own pending space
update public.spaces
set latitude = 10.3200, longitude = 123.8900, price_tier = 'free'
where id = 'e0000000-0000-4000-8000-000000000002';

select results_eq(
  $$select latitude, longitude, price_tier from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values (10.3200::double precision, 123.8900::double precision, 'free'::public.price_tier)$$,
  'a host can update coordinates and price_tier on their own pending space'
);

-- Host cannot update status on public.spaces (column status not granted, 42501)
select throws_ok(
  $$update public.spaces set status = 'verified' where id = 'e0000000-0000-4000-8000-000000000002'$$,
  '42501',
  null,
  'a host cannot update space status'
);

-- Host cannot update coordinates or price_tier on another Host''s space (0 rows updated)
update public.spaces
set latitude = 10.0000, longitude = 123.0000
where id = 'e0000000-0000-4000-8000-000000000003';

select is(
  (select latitude from public.spaces where id = 'e0000000-0000-4000-8000-000000000003'),
  null,
  'a host cannot update coordinates on another host''s space'
);

-- Coordinate check constraints
select throws_ok(
  $$update public.spaces set latitude = 95.0 where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'latitude > 90 violates check constraint'
);

select throws_ok(
  $$update public.spaces set latitude = -95.0 where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'latitude < -90 violates check constraint'
);

select throws_ok(
  $$update public.spaces set longitude = 185.0 where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'longitude > 180 violates check constraint'
);

select throws_ok(
  $$update public.spaces set longitude = -185.0 where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'longitude < -180 violates check constraint'
);

-- Host can insert curated tags on own verified space
insert into public.space_curated_tags (space_id, tag_id)
values ('e0000000-0000-4000-8000-000000000001', 'ac_full');

select results_eq(
  $$select count(*)::int from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000001' and tag_id = 'ac_full'$$,
  $$values (1)$$,
  'a host can insert curated tags on their own verified space'
);

-- Host can insert curated tags on own pending space
insert into public.space_curated_tags (space_id, tag_id)
values ('e0000000-0000-4000-8000-000000000002', 'wifi_fast');

select results_eq(
  $$select count(*)::int from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000002' and tag_id = 'wifi_fast'$$,
  $$values (1)$$,
  'a host can insert curated tags on their own pending space'
);

-- Host cannot insert curated tags on another host''s space
select throws_ok(
  $$insert into public.space_curated_tags (space_id, tag_id) values ('e0000000-0000-4000-8000-000000000003', 'wifi_fast')$$,
  '44000',
  null,
  'a host cannot insert curated tags on another host''s space'
);

-- Host can read curated tags on own pending space
select results_eq(
  $$select count(*)::int from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values (2)$$,
  'a host can read curated tags on their own pending space'
);

-- Host can delete curated tags on own space
delete from public.space_curated_tags
where space_id = 'e0000000-0000-4000-8000-000000000001' and tag_id = 'ac_full';

select results_eq(
  $$select count(*)::int from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000001' and tag_id = 'ac_full'$$,
  $$values (0)$$,
  'a host can delete curated tags on their own space'
);

-- Host cannot delete curated tags on another host''s space
delete from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000003';
select results_eq(
  $$select count(*)::int from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values (1)$$,
  'a host cannot delete curated tags on another host''s space'
);

-- Host can insert custom tag on own space
insert into public.space_custom_tags (space_id, name)
values ('e0000000-0000-4000-8000-000000000001', 'Standing Desks Available');

select results_eq(
  $$select count(*)::int from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000001' and name = 'Standing Desks Available'$$,
  $$values (1)$$,
  'a host can insert a custom tag on their own space'
);

-- Host cannot insert custom tag on another host''s space
select throws_ok(
  $$insert into public.space_custom_tags (space_id, name) values ('e0000000-0000-4000-8000-000000000003', 'Hacked Tag')$$,
  '44000',
  null,
  'a host cannot insert a custom tag on another host''s space'
);

-- Host cannot insert duplicate custom tag (case-insensitive) on own space
select throws_ok(
  $$insert into public.space_custom_tags (space_id, name) values ('e0000000-0000-4000-8000-000000000001', 'ergonomic chairs')$$,
  '23505',
  null,
  'duplicate custom tag (case-insensitive) violates unique index'
);

-- Custom tag validation: empty name
select throws_ok(
  $$insert into public.space_custom_tags (space_id, name) values ('e0000000-0000-4000-8000-000000000001', '   ')$$,
  '23514',
  null,
  'empty custom tag name violates check constraint'
);

-- Custom tag validation: illegal characters
select throws_ok(
  $$insert into public.space_custom_tags (space_id, name) values ('e0000000-0000-4000-8000-000000000001', '<script>')$$,
  '23514',
  null,
  'custom tag with < or > violates check constraint'
);

-- Host can read custom tags on own pending space
select results_eq(
  $$select name from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values ('Night Owl Friendly'::text)$$,
  'a host can read custom tags on their own pending space'
);

-- Host can delete custom tag on own space
delete from public.space_custom_tags
where space_id = 'e0000000-0000-4000-8000-000000000001' and name = 'Standing Desks Available';

select results_eq(
  $$select count(*)::int from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000001' and name = 'Standing Desks Available'$$,
  $$values (0)$$,
  'a host can delete custom tags on their own space'
);

-- Host cannot delete custom tag on another host''s space
delete from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000003';
select results_eq(
  $$select count(*)::int from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values (1)$$,
  'a host cannot delete custom tags on another host''s space'
);

-- ---------------------------------------------------------------------------
-- 4. Host 2 (b...02 - owns e...03 verified)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

-- Host 2 cannot read curated tags on Host 1''s pending space
select is_empty(
  $$select tag_id from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'host 2 cannot read curated tags on host 1''s pending space'
);

-- Host 2 cannot read custom tags on Host 1''s pending space
select is_empty(
  $$select name from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  'host 2 cannot read custom tags on host 1''s pending space'
);

-- ---------------------------------------------------------------------------
-- 5. Administrator (a...01)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Admin can read curated tags of a pending space
select results_eq(
  $$select count(*)::int from public.space_curated_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values (2)$$,
  'an administrator can read curated tags on a pending space'
);

-- Admin can read custom tags of a pending space
select results_eq(
  $$select name from public.space_custom_tags where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values ('Night Owl Friendly'::text)$$,
  'an administrator can read custom tags on a pending space'
);

rollback;
