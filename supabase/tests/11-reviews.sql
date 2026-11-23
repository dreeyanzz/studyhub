-- STORY-13, TSK-13.1: reviews and review reports.
-- Tests docs/design/STORY-13-reviews.md §2 and §4, and docs/flows/review-lifecycle.md
-- (RV1 to RV3, RV9, RP1, RP3, N1 to N6, N10 to N12, N15 to N17). N13's grants are
-- checked here too; STORY-14's review-moderation file tests the rest of N13.
--
-- Seed accounts:
--   admin   a0000000-0000-4000-8000-000000000001  Alma Reyes
--   host    b0000000-0000-4000-8000-000000000001  Hugo Santos
--   host2   b0000000-0000-4000-8000-000000000002  Hana Villanueva
--   seeker  c0000000-0000-4000-8000-000000000001  Sam Dela Cruz  ("Sam C.")
--   seeker2 c0000000-0000-4000-8000-000000000002  Rina Bautista  ("Rina B.")
-- Made here:
--   juan    13d00000-0000-4000-8000-000000000001  Juan dela Cruz ("Juan C."), Seeker
--   ada     13d00000-0000-4000-8000-000000000002  Ada Moderator, Administrator
--
-- The tests count reviews on Spaces of their own (design §2, "Seed data"):
--   SV 13e...01 host@  verified  the Space most moves happen on
--   SP 13e...02 host@  pending   Sam's review (posted below) and Juan's
--   SW 13e...03 host2@ verified  the sort, paging and averages Space
--   SD 13e...04 host2@ verified  deleted in RV9
--   SE 13e...05 host@  verified  no reviews
--   SC 13e...06 host2@ verified  52 reviews, for the page size clamp
--
-- STORY-14's moderate_review doesn't exist yet, so a hidden or removed review has its
-- status set as postgres before the test acts as a user (design §4).

begin;
create extension if not exists pgtap with schema extensions;
select plan(100);

-- Returns '<SQLSTATE> <hint>', to tell a function's refusals apart (testing guide).
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

-- A finished reservation: a visit when p_checked_in_at is set, otherwise one that
-- expired without a check-in.
create function pg_temp.reservation(
  p_id uuid,
  p_seeker_id uuid,
  p_space_id uuid,
  p_checked_in_at timestamptz
)
returns void
language sql
as $$
  insert into public.reservations (
    id, seeker_id, space_id, unit_label, status, wait_window,
    payment_window_ends_at, checked_in_at, checked_out_at, ended_at
  ) values (
    p_id, p_seeker_id, p_space_id, 'T1',
    case when p_checked_in_at is null then 'expired' else 'completed' end::public.reservation_status,
    interval '60 minutes',
    coalesce(p_checked_in_at, now() - interval '7 days') - interval '20 minutes',
    p_checked_in_at,
    p_checked_in_at + interval '2 hours',
    coalesce(p_checked_in_at + interval '2 hours', now() - interval '7 days')
  );
$$;

-- A review written as postgres, on the reservation's Space and by its Seeker.
create function pg_temp.review(
  p_id uuid,
  p_reservation_id uuid,
  p_quietness integer,
  p_wifi_reliability integer,
  p_cleanliness integer,
  p_comfort integer,
  p_created_at timestamptz
)
returns void
language sql
as $$
  insert into public.reviews (
    id, reservation_id, space_id, author_id,
    quietness, wifi_reliability, cleanliness, comfort, created_at
  )
  select p_id, r.id, r.space_id, r.seeker_id,
    p_quietness, p_wifi_reliability, p_cleanliness, p_comfort, p_created_at
  from public.reservations r
  where r.id = p_reservation_id;
$$;

-- ---------------------------------------------------------------------------
-- 0. Fixtures, as postgres
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '13d00000-0000-4000-8000-000000000001',
   'juan.reviews@example.test', '{"role": "seeker", "full_name": "Juan dela Cruz"}'),
  ('00000000-0000-0000-0000-000000000000', '13d00000-0000-4000-8000-000000000002',
   'ada.reviews@example.test', '{"role": "seeker", "full_name": "Ada Moderator"}');

update public.profiles
set role = 'admin'
where id = '13d00000-0000-4000-8000-000000000002';

insert into public.spaces (id, host_id, name, address, opens_at, closes_at, status)
values
  ('13e00000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Review Test Hall', '1 Test Street, Cebu City', '00:00', '00:00', 'verified'),
  ('13e00000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'Review Test Pending', '2 Test Street, Cebu City', '00:00', '00:00', 'pending'),
  ('13e00000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   'Review Test Sorting', '3 Test Street, Cebu City', '00:00', '00:00', 'verified'),
  ('13e00000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002',
   'Review Test Deleted', '4 Test Street, Cebu City', '00:00', '00:00', 'verified'),
  ('13e00000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001',
   'Review Test Empty', '5 Test Street, Cebu City', '00:00', '00:00', 'verified'),
  ('13e00000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002',
   'Review Test Many', '6 Test Street, Cebu City', '00:00', '00:00', 'verified');

-- Reservations 13a...NN, and the reviews written as postgres (13b...NN, where NN is the
-- visit's number). In a do block, so the fixtures print nothing.
do $$
begin
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001', now() - interval '2 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001', null);
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', '13e00000-0000-4000-8000-000000000001', now() - interval '3 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000003', now() - interval '4 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000002', now() - interval '2 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001', now() - interval '4 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001', now() - interval '2 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000002', '13e00000-0000-4000-8000-000000000001', now() - interval '2 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000009', '13d00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001', now() - interval '2 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000002', '13e00000-0000-4000-8000-000000000001', now() - interval '5 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000011', '13d00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000003', now() - interval '6 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002', '13e00000-0000-4000-8000-000000000003', now() - interval '6 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000013', '13d00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000003', now() - interval '6 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000002', '13e00000-0000-4000-8000-000000000003', now() - interval '6 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000015', '13d00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000003', now() - interval '6 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000016', '13d00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000003', now() - interval '6 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000017', 'c0000000-0000-4000-8000-000000000002', '13e00000-0000-4000-8000-000000000004', now() - interval '6 days');
  perform pg_temp.reservation('13a00000-0000-4000-8000-000000000018', '13d00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000002', now() - interval '6 days');

  -- On SV: Juan's review, to be hidden, and Rina's second, to be removed.
  perform pg_temp.review('13b00000-0000-4000-8000-000000000009', '13a00000-0000-4000-8000-000000000009', 3, 3, 3, 3, now() - interval '1 day');
  perform pg_temp.review('13b00000-0000-4000-8000-000000000010', '13a00000-0000-4000-8000-000000000010', 2, 2, 2, 2, now() - interval '1 day');

  -- On SW. Overall: a 4.75, b 1.75, c 3.5, d 4 (Sam's own), e 3.5, g hidden, h removed.
  perform pg_temp.review('13b00000-0000-4000-8000-000000000011', '13a00000-0000-4000-8000-000000000011', 5, 5, 5, 4, now() - interval '2 days');      -- a, Juan
  perform pg_temp.review('13b00000-0000-4000-8000-000000000012', '13a00000-0000-4000-8000-000000000012', 2, 1, 2, 2, now() - interval '1 day');       -- b, Rina
  perform pg_temp.review('13b00000-0000-4000-8000-000000000013', '13a00000-0000-4000-8000-000000000013', 4, 3, 4, 3, now() - interval '3 days');      -- c, Juan
  perform pg_temp.review('13b00000-0000-4000-8000-000000000004', '13a00000-0000-4000-8000-000000000004', 4, 4, 3, 5, now() - interval '4 days');      -- d, Sam
  perform pg_temp.review('13b00000-0000-4000-8000-000000000014', '13a00000-0000-4000-8000-000000000014', 3, 4, 3, 4, now() - interval '36 hours');    -- e, Rina
  perform pg_temp.review('13b00000-0000-4000-8000-000000000015', '13a00000-0000-4000-8000-000000000015', 1, 1, 1, 1, now() - interval '10 minutes'); -- g, Juan
  perform pg_temp.review('13b00000-0000-4000-8000-000000000016', '13a00000-0000-4000-8000-000000000016', 1, 2, 1, 2, now() - interval '20 minutes'); -- h, Juan

  -- On SP: Juan's review, for reporting a review of a Pending Space.
  perform pg_temp.review('13b00000-0000-4000-8000-000000000018', '13a00000-0000-4000-8000-000000000018', 2, 2, 2, 2, now() - interval '1 day');

  -- On SD: Rina's review, which Sam reports below.
  perform pg_temp.review('13b00000-0000-4000-8000-000000000017', '13a00000-0000-4000-8000-000000000017', 4, 4, 4, 4, now() - interval '1 day');
end;
$$;

insert into public.review_reports (id, review_id, reporter_id, reason)
values ('13c00000-0000-4000-8000-000000000017', '13b00000-0000-4000-8000-000000000017',
        'c0000000-0000-4000-8000-000000000001', 'spam');

-- On SC: 52 visits by Juan, each reviewed, the first the newest.
insert into public.reservations (
  id, seeker_id, space_id, unit_label, status, wait_window,
  payment_window_ends_at, checked_in_at, checked_out_at, ended_at
)
select
  ('13a10000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  '13d00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000006',
  'T1', 'completed', interval '60 minutes',
  now() - interval '8 days', now() - interval '8 days', now() - interval '7 days',
  now() - interval '7 days'
from generate_series(1, 52) as i;

insert into public.reviews (
  id, reservation_id, space_id, author_id,
  quietness, wifi_reliability, cleanliness, comfort, created_at
)
select
  ('13b10000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  ('13a10000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  '13e00000-0000-4000-8000-000000000006', '13d00000-0000-4000-8000-000000000001',
  3, 3, 3, 3, now() - make_interval(mins => i)
from generate_series(1, 52) as i;

-- ---------------------------------------------------------------------------
-- 1. The trigger and the helpers, as postgres
-- ---------------------------------------------------------------------------
update public.reviews set status = 'hidden'
where id in ('13b00000-0000-4000-8000-000000000009', '13b00000-0000-4000-8000-000000000015');
update public.reviews set status = 'removed'
where id in ('13b00000-0000-4000-8000-000000000010', '13b00000-0000-4000-8000-000000000016');

select results_eq(
  $$select version, edited_at is null from public.reviews
    where id in ('13b00000-0000-4000-8000-000000000009', '13b00000-0000-4000-8000-000000000010')$$,
  $$values (1, true), (1, true)$$,
  'a change to the status alone leaves version and edited_at as they were (RV2)'
);

select is(private.reviewer_short_name('Juan dela Cruz'), 'Juan C.',
  'the short name is the first word and the last word''s initial (D-081)');
select is(private.reviewer_short_name('Rina'), 'Rina',
  'a one-word name reads as it is (D-081)');
select is(private.reviewer_short_name('  Ana   Maria   Santos '), 'Ana S.',
  'the short name ignores extra spaces around and between the words');
select is(private.reviewer_short_name(''), 'Worq Seeker',
  'an empty name reads Worq Seeker (D-081)');
select is(private.reviewer_short_name(null), 'Worq Seeker',
  'a null name reads Worq Seeker (D-081)');

-- ---------------------------------------------------------------------------
-- 2. Grants on the helpers, and my_reviewable_visit before any post
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select private.is_reviewable_visit('13a00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'a signed-out visitor cannot run private.is_reviewable_visit'
);

select throws_ok(
  $$select * from public.my_reviewable_visit('13e00000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'a signed-out visitor cannot run my_reviewable_visit'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select private.reviewer_short_name('Juan dela Cruz')$$,
  '42501', null,
  'a signed-in user cannot run private.reviewer_short_name: only the reads call it'
);

select results_eq(
  $$select reservation_id from public.my_reviewable_visit('13e00000-0000-4000-8000-000000000001')$$,
  $$values ('13a00000-0000-4000-8000-000000000001'::uuid)$$,
  'my_reviewable_visit returns the caller''s newest visit with no review'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is_empty(
  $$select * from public.my_reviewable_visit('13e00000-0000-4000-8000-000000000001')$$,
  'my_reviewable_visit returns nothing to a Host, even one with a checked-in reservation'
);

set local request.jwt.claims =
  '{"sub": "13d00000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select * from public.my_reviewable_visit('13e00000-0000-4000-8000-000000000001')$$,
  'a visit whose review was hidden is still used: my_reviewable_visit returns nothing (D-081)'
);

-- ---------------------------------------------------------------------------
-- 3. Posting: RV1, N1, N2, N3, N6, N15
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort, comment)
    values ('13a00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001', 4, 4, 3, 4, 'Quiet in the mornings.')$$,
  'RV1: a Seeker with a visit posts a review'
);

select results_eq(
  $$select status, version, edited_at is null, author_id from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000001'$$,
  $$values ('visible'::public.review_status, 1, true, 'c0000000-0000-4000-8000-000000000001'::uuid)$$,
  'RV1: the new review is visible at version 1, not edited, and its author is the caller'
);

select results_eq(
  $$select reservation_id from public.my_reviewable_visit('13e00000-0000-4000-8000-000000000001')$$,
  $$values ('13a00000-0000-4000-8000-000000000006'::uuid)$$,
  'once the newest visit is reviewed, my_reviewable_visit returns the next one'
);

select lives_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000005', '13e00000-0000-4000-8000-000000000002', 3, 3, 3, 3)$$,
  'RV1: a Seeker reviews a visit to a Pending Space (D-081)'
);

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000002', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3)$$,
  '42501', null,
  'N1: a Seeker cannot review a reservation with no check-in'
);

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000003', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3)$$,
  '42501', null,
  'N1: a Seeker cannot review another Seeker''s visit'
);

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000004', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3)$$,
  '42501', null,
  'N1: a Seeker cannot review a visit under another Space'
);

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001', 5, 5, 5, 5)$$,
  '23505', null,
  'N2: a Seeker cannot post a second review on one visit'
);

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort, status)
    values ('13a00000-0000-4000-8000-000000000006', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3, 'hidden')$$,
  '42501', null,
  'N6: a Seeker cannot post a review with a status of their choosing'
);

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000006', '13e00000-0000-4000-8000-000000000001', 0, 3, 3, 3)$$,
  '23514', null,
  'N15: a rating of 0 is refused'
);

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000006', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 6)$$,
  '23514', null,
  'N15: a rating of 6 is refused'
);

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort, comment)
    values ('13a00000-0000-4000-8000-000000000006', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3, repeat('a', 501))$$,
  '23514', null,
  'N15: a comment over 500 characters is refused'
);

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort, comment)
    values ('13a00000-0000-4000-8000-000000000006', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3, '   ')$$,
  '23514', null,
  'N15: a blank comment is refused: the form sends it as null'
);

select lives_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort, comment)
    values ('13a00000-0000-4000-8000-000000000006', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3, repeat('a', 500))$$,
  'N15: a comment of exactly 500 characters is accepted'
);

set local request.jwt.claims =
  '{"sub": "13d00000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000009', '13e00000-0000-4000-8000-000000000001', 5, 5, 5, 5)$$,
  '23505', null,
  'N2: an author cannot post again on a visit whose review was hidden'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000010', '13e00000-0000-4000-8000-000000000001', 5, 5, 5, 5)$$,
  '23505', null,
  'N2: an author cannot post again on a visit whose review was removed'
);

select lives_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000003', '13e00000-0000-4000-8000-000000000001', 4, 5, 4, 4)$$,
  'RV1: a Seeker posts a review with no comment'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000007', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3)$$,
  '42501', null,
  'N3: an Administrator cannot post a review, even of their own checked-in reservation'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000008', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3)$$,
  '42501', null,
  'N3: a Host cannot post a review, even of their own checked-in reservation'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001', 3, 3, 3, 3)$$,
  '42501', null,
  'N3: a signed-out visitor cannot post a review'
);

-- ---------------------------------------------------------------------------
-- 4. Reading: N10, and RV1 on a Pending Space
-- ---------------------------------------------------------------------------
select is_empty(
  $$select id from public.reviews
    where id in ('13b00000-0000-4000-8000-000000000009', '13b00000-0000-4000-8000-000000000010')$$,
  'N10: a signed-out visitor cannot read a hidden or removed review'
);

select is_empty(
  $$select id from public.reviews where reservation_id = '13a00000-0000-4000-8000-000000000005'$$,
  'N10: a signed-out visitor cannot read a review of a Pending Space'
);

select results_eq(
  $$select count(*)::integer from public.reviews where space_id = '13e00000-0000-4000-8000-000000000003'$$,
  $$values (5)$$,
  'a signed-out visitor reads the visible reviews of a Verified Space'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is_empty(
  $$select id from public.reviews where reservation_id = '13a00000-0000-4000-8000-000000000005'$$,
  'RV1, N10: another Seeker cannot read a review of a Pending Space'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select id from public.reviews
    where id in ('13b00000-0000-4000-8000-000000000009', '13b00000-0000-4000-8000-000000000010')$$,
  'N10: a Seeker cannot read another Seeker''s hidden or removed review'
);

select isnt_empty(
  $$select id from public.reviews where reservation_id = '13a00000-0000-4000-8000-000000000005'$$,
  'RV1: the author reads their own review of a Pending Space'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select id from public.reviews
    where id in ('13b00000-0000-4000-8000-000000000009', '13b00000-0000-4000-8000-000000000010')$$,
  'N10: the Space''s Host cannot read a hidden or removed review'
);

select is_empty(
  $$select id from public.reviews where reservation_id = '13a00000-0000-4000-8000-000000000005'$$,
  'N10: the Space''s Host cannot read a review of their Pending Space'
);

set local request.jwt.claims =
  '{"sub": "13d00000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select status from public.reviews where id = '13b00000-0000-4000-8000-000000000009'$$,
  $$values ('hidden'::public.review_status)$$,
  'N10: the author reads their own hidden review'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select count(*)::integer from public.reviews
    where id in ('13b00000-0000-4000-8000-000000000009', '13b00000-0000-4000-8000-000000000010')
      or space_id = '13e00000-0000-4000-8000-000000000002'$$,
  $$values (4)$$,
  'N10: an Administrator reads hidden and removed reviews, and every review of a Pending Space'
);

-- ---------------------------------------------------------------------------
-- 5. Editing and deleting: RV2, RV3, N4, N5, N6
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select isnt_empty(
  $$update public.reviews set quietness = 5
    where reservation_id = '13a00000-0000-4000-8000-000000000001' returning id$$,
  'RV2: an author edits their review'
);

select results_eq(
  $$select quietness, version, edited_at is not null from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000001'$$,
  $$values (5::smallint, 2, true)$$,
  'RV2: an author edits their review: its version goes up and edited_at is set'
);

update public.reviews set quietness = 5
where reservation_id = '13a00000-0000-4000-8000-000000000001';

select results_eq(
  $$select version from public.reviews where reservation_id = '13a00000-0000-4000-8000-000000000001'$$,
  $$values (2)$$,
  'RV2: an update that changes no rating or comment leaves the version as it was'
);

select throws_ok(
  $$update public.reviews set status = 'hidden'
    where reservation_id = '13a00000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'N6: an author cannot change their review''s status'
);

select throws_ok(
  $$update public.reviews set version = 1
    where reservation_id = '13a00000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'N6: an author cannot change their review''s version'
);

select throws_ok(
  $$update public.reviews set space_id = '13e00000-0000-4000-8000-000000000005'
    where reservation_id = '13a00000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'N6: an author cannot move their review to another Space'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

update public.reviews set comment = 'Fast Wi-Fi.'
where reservation_id = '13a00000-0000-4000-8000-000000000003';

select results_eq(
  $$select comment, version, edited_at is not null from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  $$values ('Fast Wi-Fi.', 2, true)$$,
  'RV2: adding a comment to a review that had none counts as an edit'
);

select is_empty(
  $$update public.reviews set quietness = 1
    where reservation_id = '13a00000-0000-4000-8000-000000000001' returning id$$,
  'N4: another Seeker editing a review affects 0 rows'
);

select is_empty(
  $$delete from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000001' returning id$$,
  'N4: another Seeker deleting a review affects 0 rows'
);

select is_empty(
  $$update public.reviews set quietness = 5
    where id = '13b00000-0000-4000-8000-000000000010' returning id$$,
  'N5: an author cannot edit their removed review'
);

select is_empty(
  $$delete from public.reviews where id = '13b00000-0000-4000-8000-000000000010' returning id$$,
  'N5: an author cannot delete their removed review'
);

set local request.jwt.claims =
  '{"sub": "13d00000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$update public.reviews set quietness = 5
    where id = '13b00000-0000-4000-8000-000000000009' returning id$$,
  'N5: an author cannot edit their hidden review'
);

select is_empty(
  $$delete from public.reviews where id = '13b00000-0000-4000-8000-000000000009' returning id$$,
  'N5: an author cannot delete their hidden review'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$update public.reviews set status = 'hidden'
    where reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  '42501', null,
  'N6: an Administrator cannot write a review''s status directly'
);

set local role postgres;

select results_eq(
  $$select reservation_id, quietness, version from public.reviews
    where reservation_id in ('13a00000-0000-4000-8000-000000000001', '13a00000-0000-4000-8000-000000000009', '13a00000-0000-4000-8000-000000000010')
    order by reservation_id$$,
  $$values ('13a00000-0000-4000-8000-000000000001'::uuid, 5::smallint, 2),
           ('13a00000-0000-4000-8000-000000000009'::uuid, 3::smallint, 1),
           ('13a00000-0000-4000-8000-000000000010'::uuid, 2::smallint, 1)$$,
  'N4, N5: the refused edits and deletes left those reviews as they were'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select isnt_empty(
  $$delete from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000001' returning id$$,
  'RV3: an author deletes their visible review'
);

select lives_ok(
  $$insert into public.reviews (reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort)
    values ('13a00000-0000-4000-8000-000000000001', '13e00000-0000-4000-8000-000000000001', 4, 4, 4, 4)$$,
  'RV3: after deleting it, the author posts a new review for the same visit'
);

-- ---------------------------------------------------------------------------
-- 6. Reports: RP1, N11, N12, N13, N15
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into public.review_reports (review_id, reason, note)
    select id, 'spam', 'Looks copied from another site.' from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  'RP1: a Seeker reports another Seeker''s review'
);

select results_eq(
  $$select rr.review_version, rr.reporter_id, rr.outcome is null
    from public.review_reports rr
    join public.reviews r on r.id = rr.review_id
    where r.reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  $$values (2, 'c0000000-0000-4000-8000-000000000001'::uuid, true)$$,
  'a report records the review''s current version, its reporter, and is open'
);

select results_eq(
  $$select reported_by_caller from public.space_reviews('13e00000-0000-4000-8000-000000000001')
    where id = (select id from public.reviews where reservation_id = '13a00000-0000-4000-8000-000000000003')$$,
  $$values (true)$$,
  'space_reviews tells the reporter they have reported that version'
);

select throws_ok(
  $$insert into public.review_reports (review_id, reason)
    select id, 'other' from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  '23505', null,
  'N11: a user cannot report the same version twice'
);

select throws_ok(
  $$insert into public.review_reports (review_id, reason, review_version)
    select id, 'other', 1 from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  '42501', null,
  'N11: a reporter cannot choose which version they report'
);

select throws_ok(
  $$insert into public.review_reports (review_id, reason)
    values ('13b00000-0000-4000-8000-000000000009', 'offensive')$$,
  '42501', null,
  'N11: a user cannot report a hidden review'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$insert into public.review_reports (review_id, reason)
    select id, 'spam' from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  '42501', null,
  'N11: an author cannot report their own review'
);

select throws_ok(
  $$insert into public.review_reports (review_id, reason)
    values ('13b00000-0000-4000-8000-000000000018', 'spam')$$,
  '42501', null,
  'N11: a user cannot report a review of a Pending Space'
);

select is_empty(
  $$select rr.id from public.review_reports rr
    join public.reviews r on r.id = rr.review_id
    where r.reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  'N12: a review''s author reads 0 of its reports'
);

-- The author edits again: version 3, which nobody has reported yet.
update public.reviews set comfort = 5
where reservation_id = '13a00000-0000-4000-8000-000000000003';

set local request.jwt.claims =
  '{"sub": "13d00000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$insert into public.review_reports (review_id, reason, note)
    select id, 'other', repeat('n', 301) from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  '23514', null,
  'N15: a report note over 300 characters is refused'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select reported_by_caller from public.space_reviews('13e00000-0000-4000-8000-000000000001')
    where id = (select id from public.reviews where reservation_id = '13a00000-0000-4000-8000-000000000003')$$,
  $$values (false)$$,
  'after its author edits it, the reporter has not reported the new version'
);

select lives_ok(
  $$insert into public.review_reports (review_id, reason)
    select id, 'spam' from public.reviews
    where reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  'RP1: a user reports a review again after its author edits it'
);

select results_eq(
  $$select rr.review_version from public.review_reports rr
    join public.reviews r on r.id = rr.review_id
    where r.reservation_id = '13a00000-0000-4000-8000-000000000003'
    order by rr.review_version$$,
  $$values (2), (3)$$,
  'the reporter reads their own two reports, one for each version'
);

select throws_ok(
  $$update public.review_reports set note = 'Changed my mind.'
    where reporter_id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'N13: a reporter cannot edit their report'
);

select throws_ok(
  $$delete from public.review_reports
    where reporter_id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'N13: a reporter cannot delete their report'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select rr.id from public.review_reports rr
    join public.reviews r on r.id = rr.review_id
    where r.reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  'N12: the Space''s Host reads 0 of a review''s reports'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select count(*)::integer from public.review_reports rr
    join public.reviews r on r.id = rr.review_id
    where r.reservation_id = '13a00000-0000-4000-8000-000000000003'$$,
  $$values (2)$$,
  'N12: an Administrator reads every report'
);

select throws_ok(
  $$update public.review_reports set outcome = 'dismissed', closed_by = 'a0000000-0000-4000-8000-000000000001', closed_at = now()$$,
  '42501', null,
  'N13: an Administrator cannot close a report directly: only moderate_review will (STORY-14)'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$insert into public.review_reports (review_id, reason)
    values ('13b00000-0000-4000-8000-000000000012', 'spam')$$,
  '42501', null,
  'N11: a signed-out visitor cannot report a review'
);

select throws_ok(
  $$select id from public.review_reports$$,
  '42501', null,
  'N12: a signed-out visitor cannot read reports at all'
);

-- ---------------------------------------------------------------------------
-- 7. space_reviews and space_review_summary: N10, N16, N17
-- ---------------------------------------------------------------------------
select results_eq(
  $$select id from public.space_reviews('13e00000-0000-4000-8000-000000000003')$$,
  $$values ('13b00000-0000-4000-8000-000000000012'::uuid), ('13b00000-0000-4000-8000-000000000014'::uuid),
           ('13b00000-0000-4000-8000-000000000011'::uuid), ('13b00000-0000-4000-8000-000000000013'::uuid),
           ('13b00000-0000-4000-8000-000000000004'::uuid)$$,
  'a signed-out visitor gets every visible review from space_reviews, newest first'
);

select results_eq(
  $$select distinct reviewer_name from public.space_reviews('13e00000-0000-4000-8000-000000000003') order by 1$$,
  $$values ('Juan C.'), ('Rina B.'), ('Sam C.')$$,
  'N17: a review read returns the reviewer''s short name, never their full name'
);

select results_eq(
  $$select count(*)::integer, min(id::text)
    from public.space_reviews('13e00000-0000-4000-8000-000000000006', 'newest', 100, -5)$$,
  $$select 51, min(id::text) from (
      select id from public.reviews where space_id = '13e00000-0000-4000-8000-000000000006'
      order by created_at desc limit 51) as first_51$$,
  'space_reviews clamps a page size of 100 to 51, and a negative offset to 0'
);

select results_eq(
  $$select id from public.space_reviews('13e00000-0000-4000-8000-000000000006', 'newest', 100, -5)
    with ordinality as t order by t.ordinality limit 1$$,
  $$values ('13b10000-0000-4000-8000-000000000001'::uuid)$$,
  'space_reviews with a negative offset starts from the first review'
);

select is(
  pg_temp.refusal($$select * from public.space_reviews('13e00000-0000-4000-8000-000000000003', 'best')$$),
  'P0001 invalid_sort',
  'space_reviews refuses an unknown sort'
);

select results_eq(
  $$select review_count, avg_quietness, avg_wifi_reliability, avg_cleanliness, avg_comfort, avg_overall
    from public.space_review_summary(array['13e00000-0000-4000-8000-000000000003'::uuid])$$,
  $$values (5, 3.6, 3.4, 3.4, 3.6, 3.5)$$,
  'N16: the averages leave out hidden and removed reviews'
);

select is_empty(
  $$select * from public.space_review_summary(array['13e00000-0000-4000-8000-000000000002'::uuid])$$,
  'N16: a Pending Space''s averages read as none'
);

select results_eq(
  $$select * from public.space_review_summary(array['13e00000-0000-4000-8000-000000000005'::uuid])$$,
  $$values ('13e00000-0000-4000-8000-000000000005'::uuid, 0, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric)$$,
  'space_review_summary gives a Verified Space with no reviews a count of 0 and null averages'
);

select is(
  pg_temp.refusal($$select * from public.space_review_summary(array(select gen_random_uuid() from generate_series(1, 101)))$$),
  'P0001 too_many_spaces',
  'space_review_summary refuses more than 100 Spaces'
);

select lives_ok(
  $$select * from public.space_review_summary(array(select gen_random_uuid() from generate_series(1, 100)))$$,
  'space_review_summary accepts 100 Spaces'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select id from public.space_reviews('13e00000-0000-4000-8000-000000000003', 'newest')$$,
  $$values ('13b00000-0000-4000-8000-000000000012'::uuid), ('13b00000-0000-4000-8000-000000000014'::uuid),
           ('13b00000-0000-4000-8000-000000000011'::uuid), ('13b00000-0000-4000-8000-000000000013'::uuid)$$,
  'space_reviews sorts by newest, and leaves out the caller''s own reviews'
);

select results_eq(
  $$select id, overall from public.space_reviews('13e00000-0000-4000-8000-000000000003', 'highest')$$,
  $$values ('13b00000-0000-4000-8000-000000000011'::uuid, 4.75), ('13b00000-0000-4000-8000-000000000014'::uuid, 3.5),
           ('13b00000-0000-4000-8000-000000000013'::uuid, 3.5), ('13b00000-0000-4000-8000-000000000012'::uuid, 1.75)$$,
  'space_reviews sorts by highest overall rating, then newest first'
);

select results_eq(
  $$select id from public.space_reviews('13e00000-0000-4000-8000-000000000003', 'lowest')$$,
  $$values ('13b00000-0000-4000-8000-000000000012'::uuid), ('13b00000-0000-4000-8000-000000000014'::uuid),
           ('13b00000-0000-4000-8000-000000000013'::uuid), ('13b00000-0000-4000-8000-000000000011'::uuid)$$,
  'space_reviews sorts by lowest overall rating, then newest first'
);

select results_eq(
  $$select id from public.space_reviews('13e00000-0000-4000-8000-000000000003', 'newest', 2, 1)$$,
  $$values ('13b00000-0000-4000-8000-000000000014'::uuid), ('13b00000-0000-4000-8000-000000000011'::uuid)$$,
  'space_reviews pages by size and offset'
);

select is_empty(
  $$select * from public.space_reviews('13e00000-0000-4000-8000-000000000002')$$,
  'N10: space_reviews returns nothing for a Pending Space, even to the author of a review there'
);

-- ---------------------------------------------------------------------------
-- 8. Deleting: RP3, RV9, and a closed report whose Administrator is deleted
-- ---------------------------------------------------------------------------
set local role postgres;

create temp table _rina_sv_review as
select id from public.reviews where reservation_id = '13a00000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

delete from public.reviews where reservation_id = '13a00000-0000-4000-8000-000000000003';

set local role postgres;

select is_empty(
  $$select id from public.review_reports where review_id = (select id from _rina_sv_review)$$,
  'RP3: deleting a review deletes its reports'
);

delete from public.spaces where id = '13e00000-0000-4000-8000-000000000004';

select is_empty(
  $$select id from public.reviews where id = '13b00000-0000-4000-8000-000000000017'$$,
  'RV9: deleting a Space deletes its reviews'
);

select is_empty(
  $$select id from public.review_reports where id = '13c00000-0000-4000-8000-000000000017'$$,
  'RV9: deleting a Space deletes its reviews'' reports'
);

select throws_ok(
  $$insert into public.review_reports (review_id, reporter_id, reason, outcome)
    values ('13b00000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000001', 'spam', 'dismissed')$$,
  '23514', null,
  'a report cannot have an outcome without a closing time'
);

insert into public.review_reports (id, review_id, reporter_id, reason, outcome, closed_by, closed_at)
values ('13c00000-0000-4000-8000-000000000012', '13b00000-0000-4000-8000-000000000012',
        '13d00000-0000-4000-8000-000000000001', 'other', 'dismissed',
        '13d00000-0000-4000-8000-000000000002', now());

select lives_ok(
  $$delete from auth.users where id = '13d00000-0000-4000-8000-000000000002'$$,
  'deleting the account of an Administrator who closed a report succeeds'
);

select results_eq(
  $$select outcome, closed_by is null, closed_at is not null from public.review_reports
    where id = '13c00000-0000-4000-8000-000000000012'$$,
  $$values ('dismissed'::public.review_report_outcome, true, true)$$,
  'the report keeps its outcome and closing time, with closed_by set to null'
);

select * from finish();
rollback;
