-- STORY-08 performance follow-up: public.discovery_spaces() pgTAP tests (D-047, D-055, D-063, D-076, D-080).
-- Uses the seeded accounts and spaces from supabase/seed.sql:
--   admin  a0000000-0000-4000-8000-000000000001
--   host   b0000000-0000-4000-8000-000000000001  owns e…01 (verified), e…02 (pending)
--   host2  b0000000-0000-4000-8000-000000000002  owns e…03 (verified)
--   seeker c0000000-0000-4000-8000-000000000001
--   seeker2 c0000000-0000-4000-8000-000000000002 (authored two seeded reviews on e…01)

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Seed extra fixtures as postgres:
--   - a rejected space and a taken_down space (must never appear for any role, D-055)
--   - curated & custom tags on e…01
--   - photos on e…01 (dotfile + older photo + newer photo) and e…02 (pending)
--   - hide one of seeker2's seeded reviews (a3…02) so only a3…01 (avg 4.5) counts
insert into public.spaces (id, host_id, name, address, opens_at, closes_at, status)
values
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001',
   'Rejected Loft', '1 Rejected Way, Cebu City', '08:00', '20:00', 'rejected'),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001',
   'Taken Down Studio', '2 Down Ave, Cebu City', '08:00', '20:00', 'taken_down');

insert into public.space_curated_tags (space_id, tag_id)
values
  ('e0000000-0000-4000-8000-000000000001', 'wifi_fast'),
  ('e0000000-0000-4000-8000-000000000001', 'ac_full');

insert into public.space_custom_tags (space_id, name)
values
  ('e0000000-0000-4000-8000-000000000001', 'Brewed coffee');

update public.reviews
set status = 'hidden'
where id = 'a3000000-0000-4000-8000-000000000002';

insert into storage.objects (id, bucket_id, name, created_at)
values
  ('11000000-0000-4000-8000-000000000001', 'space-photos',
   'e0000000-0000-4000-8000-000000000001/.emptyFolderPlaceholder', now() - interval '3 days'),
  ('11000000-0000-4000-8000-000000000002', 'space-photos',
   'e0000000-0000-4000-8000-000000000001/first.jpg', now() - interval '2 days'),
  ('11000000-0000-4000-8000-000000000003', 'space-photos',
   'e0000000-0000-4000-8000-000000000001/second.jpg', now() - interval '1 day'),
  ('11000000-0000-4000-8000-000000000004', 'space-photos',
   'e0000000-0000-4000-8000-000000000002/pending.jpg', now() - interval '2 days');

-- ---------------------------------------------------------------------------
-- 1. Function grants (D-047)
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('public', 'public.discovery_spaces()', 'execute'),
  'public role has no direct execute privilege on public.discovery_spaces()'
);

select ok(
  has_function_privilege('anon', 'public.discovery_spaces()', 'execute')
  and has_function_privilege('authenticated', 'public.discovery_spaces()', 'execute'),
  'anon and authenticated can execute public.discovery_spaces()'
);

-- ---------------------------------------------------------------------------
-- 2. Anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$select id from public.discovery_spaces() order by id$$,
  $$values
    ('e0000000-0000-4000-8000-000000000001'::uuid),
    ('e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'anon sees only Verified Spaces (excludes pending, rejected, and taken_down)'
);

select results_eq(
  $$select cover_photo_path from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values ('e0000000-0000-4000-8000-000000000001/first.jpg'::text)$$,
  'anon gets the earliest non-dotfile cover photo path'
);

select results_eq(
  $$select cover_photo_path from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values (null::text)$$,
  'anon gets null cover_photo_path when a Verified Space has no photos'
);

select results_eq(
  $$select unit_types from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (array['seat', 'standing_desk', 'room']::public.unit_type[])$$,
  'anon gets distinct unit_types for a Verified Space'
);

select results_eq(
  $$select custom_tags from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (array['Brewed coffee']::text[])$$,
  'anon gets custom_tags for a Verified Space'
);

select results_eq(
  $$select jsonb_array_length(curated_tags) from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (2)$$,
  'anon gets curated_tags for a Verified Space'
);

select results_eq(
  $$select review_count, avg_overall from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (1, 4.5::numeric)$$,
  'anon gets visible-only review_count and unrounded avg_overall (hidden review excluded)'
);

select results_eq(
  $$select review_count, avg_overall from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values (0, null::numeric)$$,
  'anon gets 0 and null avg_overall for a Verified Space with no visible reviews'
);

-- ---------------------------------------------------------------------------
-- 3. Authenticated Seeker (author of the hidden review: must still exclude it)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select results_eq(
  $$select review_count, avg_overall from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (1, 4.5::numeric)$$,
  'review author still sees only visible reviews counted in discovery_spaces()'
);

-- ---------------------------------------------------------------------------
-- 4. Owning Host (owns pending e…02, rejected e…04, taken_down e…05: must get 0 rows for them)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select id from public.discovery_spaces() where id in (
    'e0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000004',
    'e0000000-0000-4000-8000-000000000005'
  )$$,
  'owning Host gets 0 rows for their own pending, rejected, and taken_down Spaces (D-055)'
);

-- ---------------------------------------------------------------------------
-- 5. Administrator (must still see only Verified Spaces and visible reviews)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select id from public.discovery_spaces() where id in (
    'e0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000004',
    'e0000000-0000-4000-8000-000000000005'
  )$$,
  'Administrator gets 0 rows for pending, rejected, and taken_down Spaces in discovery_spaces() (D-055)'
);

select results_eq(
  $$select review_count, avg_overall from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values (1, 4.5::numeric)$$,
  'Administrator still sees only visible reviews counted in discovery_spaces() (D-080)'
);

select results_eq(
  $$select cover_photo_path from public.discovery_spaces() where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values ('e0000000-0000-4000-8000-000000000001/first.jpg'::text)$$,
  'Administrator gets the same cover_photo_path for a Verified Space'
);

select * from finish();
rollback;
