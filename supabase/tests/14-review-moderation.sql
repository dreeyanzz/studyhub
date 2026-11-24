-- STORY-14, TSK-14.1: review moderation and the moderation log.
-- Tests docs/design/STORY-14-admin-console.md §2 and §4's moderation rows, and
-- docs/flows/review-lifecycle.md (RV4 to RV8, RP2, N7 to N9, N13, N14, D-080, D-095).
--
-- Seed accounts:
--   admin   a0000000-0000-4000-8000-000000000001  Alma Reyes
--   host    b0000000-0000-4000-8000-000000000001  Hugo Santos
--   seeker  c0000000-0000-4000-8000-000000000001  Sam Dela Cruz
--   seeker2 c0000000-0000-4000-8000-000000000002  Rina Bautista
-- Made here:
--   admin2  14d00000-0000-4000-8000-000000000001  Ada Moderator, Administrator (deleted at end)
--   oauth   14d00000-0000-4000-8000-000000000002  Gina Unconfirmed, unconfirmed Google OAuth (D-095)
--   marco   14d00000-0000-4000-8000-000000000003  Marco Reyes, Seeker
--
-- Dedicated Spaces so this file never depends on seed reviews:
--   SM  14e...01  verified  main moderation and averages Space (R1..R5, R7)
--   SP  14e...02  pending   non-Verified Space (R6)
--   SQ  14e...03  verified  105 hidden reviews for page-size clamping (500 -> 101)

begin;
create extension if not exists pgtap with schema extensions;
select plan(81);

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

create function pg_temp.visit(
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
    p_id, p_seeker_id, p_space_id, 'M1', 'completed', interval '60 minutes',
    p_checked_in_at - interval '20 minutes',
    p_checked_in_at, p_checked_in_at + interval '2 hours', p_checked_in_at + interval '2 hours'
  );
$$;

create function pg_temp.review(
  p_id uuid,
  p_reservation_id uuid,
  p_rating integer,
  p_comment text,
  p_created_at timestamptz
)
returns void
language sql
as $$
  insert into public.reviews (
    id, reservation_id, space_id, author_id,
    quietness, wifi_reliability, cleanliness, comfort, comment, created_at
  )
  select p_id, r.id, r.space_id, r.seeker_id,
    p_rating, p_rating, p_rating, p_rating, p_comment, p_created_at
  from public.reservations r
  where r.id = p_reservation_id;
$$;

-- ---------------------------------------------------------------------------
-- 0. Fixtures, as postgres
-- ---------------------------------------------------------------------------
set local role postgres;

insert into auth.users (instance_id, id, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '14d00000-0000-4000-8000-000000000001',
   'ada.mod@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Ada Moderator"}'),
  ('00000000-0000-4000-8000-000000000000', '14d00000-0000-4000-8000-000000000002',
   'oauth.mod@example.test', '{"provider": "google", "providers": ["google"]}',
   '{"full_name": "Gina Unconfirmed"}'),
  ('00000000-0000-4000-8000-000000000000', '14d00000-0000-4000-8000-000000000003',
   'marco.mod@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Marco Reyes"}');

update public.profiles
set role = 'admin'
where id = '14d00000-0000-4000-8000-000000000001';

insert into public.spaces (id, host_id, name, address, opens_at, closes_at, status)
values
  ('14e00000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Moderation Test Hall', '10 Mod Street, Cebu City', '00:00', '00:00', 'verified'),
  ('14e00000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'Moderation Test Pending', '11 Mod Street, Cebu City', '00:00', '00:00', 'pending'),
  ('14e00000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   'Moderation Queue Many', '12 Mod Street, Cebu City', '00:00', '00:00', 'verified');

do $$
begin
  perform pg_temp.visit('14a00000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '14e00000-0000-4000-8000-000000000001', now() - interval '6 days');
  perform pg_temp.visit('14a00000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '14e00000-0000-4000-8000-000000000001', now() - interval '5 days');
  perform pg_temp.visit('14a00000-0000-4000-8000-000000000003', '14d00000-0000-4000-8000-000000000003', '14e00000-0000-4000-8000-000000000001', now() - interval '4 days');
  perform pg_temp.visit('14a00000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', '14e00000-0000-4000-8000-000000000001', now() - interval '3 days');
  perform pg_temp.visit('14a00000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', '14e00000-0000-4000-8000-000000000001', now() - interval '2 days');
  perform pg_temp.visit('14a00000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', '14e00000-0000-4000-8000-000000000002', now() - interval '2 days');
  perform pg_temp.visit('14a00000-0000-4000-8000-000000000007', '14d00000-0000-4000-8000-000000000003', '14e00000-0000-4000-8000-000000000001', now() - interval '1 day');

  -- On SM: R1=5, R2=1, R3=3, R4=4, R5=4, R7=3 -> 6 visible reviews, avg = 20 / 6 (or check before/after)
  -- Keep R1=5, R2=1, R3=3, R4=4, R5=2 (5 reviews on SM -> sum 15, avg 3.00); R7 starts hidden below.
  perform pg_temp.review('14b00000-0000-4000-8000-000000000001', '14a00000-0000-4000-8000-000000000001', 5, 'Great quiet corner.', now() - interval '5 days');
  perform pg_temp.review('14b00000-0000-4000-8000-000000000002', '14a00000-0000-4000-8000-000000000002', 1, 'Spam link v1.', now() - interval '4 days');
  perform pg_temp.review('14b00000-0000-4000-8000-000000000003', '14a00000-0000-4000-8000-000000000003', 3, 'Fairly busy at noon.', now() - interval '3 days');
  perform pg_temp.review('14b00000-0000-4000-8000-000000000004', '14a00000-0000-4000-8000-000000000004', 4, 'Solid outlets.', now() - interval '2 days');
  perform pg_temp.review('14b00000-0000-4000-8000-000000000005', '14a00000-0000-4000-8000-000000000005', 2, 'Warm AC.', now() - interval '1 day');
  perform pg_temp.review('14b00000-0000-4000-8000-000000000006', '14a00000-0000-4000-8000-000000000006', 4, 'Review on pending Space.', now() - interval '1 day');
  perform pg_temp.review('14b00000-0000-4000-8000-000000000007', '14a00000-0000-4000-8000-000000000007', 3, 'Review for cascade check.', now() - interval '12 hours');
end;
$$;

-- Reports (inserted as postgres so timestamps are deterministic for oldest-open-first order):
--   R3: oldest open report at -4 hours (Sam)
--   R1: 2 open reports at -3 hours (Rina) and -1 hour (Marco)
--   R2: 1 open report on v1 at -2 hours (Sam), then R2 edited to v2, then 1 open report on v2 at -30 min (Marco)
--   R6 (Pending Space): 1 open report at -90 min (Rina)
insert into public.review_reports (id, review_id, reporter_id, reason, note, created_at)
values
  ('14c00000-0000-4000-8000-000000000001', '14b00000-0000-4000-8000-000000000003',
   'c0000000-0000-4000-8000-000000000001', 'not_about_space', 'Mentions street traffic only.', now() - interval '4 hours'),
  ('14c00000-0000-4000-8000-000000000002', '14b00000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'spam', 'Looks promotional.', now() - interval '3 hours'),
  ('14c00000-0000-4000-8000-000000000003', '14b00000-0000-4000-8000-000000000001',
   '14d00000-0000-4000-8000-000000000003', 'other', 'Second report.', now() - interval '1 hour'),
  ('14c00000-0000-4000-8000-000000000004', '14b00000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-000000000001', 'spam', 'Report on v1.', now() - interval '2 hours'),
  ('14c00000-0000-4000-8000-000000000006', '14b00000-0000-4000-8000-000000000006',
   'c0000000-0000-4000-8000-000000000002', 'offensive', 'Offensive wording.', now() - interval '90 minutes');

-- Edit R2 so it reaches version 2, then add a report on version 2.
update public.reviews
set comment = 'Edited spam link v2.'
where id = '14b00000-0000-4000-8000-000000000002';

insert into public.review_reports (id, review_id, reporter_id, reason, note, created_at)
values
  ('14c00000-0000-4000-8000-000000000005', '14b00000-0000-4000-8000-000000000002',
   '14d00000-0000-4000-8000-000000000003', 'spam', 'Still spam on v2.', now() - interval '30 minutes');

-- Seed one initial log row on R7 and mark R7 hidden so N14 checks non-empty log rows right away.
update public.reviews
set status = 'hidden',
    status_changed_by = 'a0000000-0000-4000-8000-000000000001',
    status_changed_at = now() - interval '6 hours'
where id = '14b00000-0000-4000-8000-000000000007';

insert into public.review_moderation_events (review_id, action, actor_id, created_at)
values ('14b00000-0000-4000-8000-000000000007', 'hide', 'a0000000-0000-4000-8000-000000000001', now() - interval '6 hours');

-- ---------------------------------------------------------------------------
-- 1. N7, N13, N14: role boundaries (anon, Seeker, Host, unconfirmed OAuth)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.moderate_review('14b00000-0000-4000-8000-000000000001', 'hide', 1)$$,
  '42501', null,
  'N7: a signed-out visitor cannot run moderate_review'
);

select throws_ok(
  $$select * from public.admin_review_queue('reported')$$,
  '42501', null,
  'N7: a signed-out visitor cannot run admin_review_queue'
);

select throws_ok(
  $$select id from public.review_moderation_events$$,
  '42501', null,
  'N14: a signed-out visitor cannot read review_moderation_events'
);

select throws_ok(
  $$insert into public.review_moderation_events (review_id, action)
    values ('14b00000-0000-4000-8000-000000000001', 'hide')$$,
  '42501', null,
  'N13: a signed-out visitor cannot write to the moderation log directly'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.moderate_review('14b00000-0000-4000-8000-000000000001', 'hide', 1)$$,
  '42501', null,
  'N7: a Seeker cannot moderate a review'
);

select throws_ok(
  $$select * from public.admin_review_queue('reported')$$,
  '42501', null,
  'a Seeker cannot run admin_review_queue'
);

select is_empty(
  $$select id from public.review_moderation_events$$,
  'N14: a Seeker reads 0 rows of the moderation log'
);

select throws_ok(
  $$insert into public.review_moderation_events (review_id, action, actor_id)
    values ('14b00000-0000-4000-8000-000000000001', 'hide', 'c0000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'N13: a Seeker cannot insert into the moderation log directly'
);

select throws_ok(
  $$update public.review_reports set note = 'Edited note.'
    where id = '14c00000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'N13: nobody can edit a report (Seeker)'
);

select throws_ok(
  $$delete from public.review_reports
    where id = '14c00000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'N13: nobody can delete a report (Seeker)'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.moderate_review('14b00000-0000-4000-8000-000000000001', 'hide', 1)$$,
  '42501', null,
  'N7: a Host cannot moderate a review'
);

select throws_ok(
  $$select * from public.admin_review_queue('reported')$$,
  '42501', null,
  'a Host cannot run admin_review_queue'
);

select is_empty(
  $$select id from public.review_moderation_events$$,
  'N14: a Host reads 0 rows of the moderation log'
);

set local request.jwt.claims =
  '{"sub": "14d00000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.moderate_review('14b00000-0000-4000-8000-000000000001', 'hide', 1)$$,
  '42501', null,
  'N7, D-095: an unconfirmed OAuth user cannot moderate a review'
);

select throws_ok(
  $$select * from public.admin_review_queue('reported')$$,
  '42501', null,
  'D-095: an unconfirmed OAuth user cannot run admin_review_queue'
);

select is_empty(
  $$select id from public.review_moderation_events$$,
  'N14, D-095: an unconfirmed OAuth user reads 0 rows of the moderation log'
);

-- ---------------------------------------------------------------------------
-- 2. Administrator direct-write checks (N13) and queue baseline
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$insert into public.review_moderation_events (review_id, action, actor_id)
    values ('14b00000-0000-4000-8000-000000000001', 'hide', 'a0000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'N13: an Administrator cannot insert into the moderation log directly'
);

select throws_ok(
  $$update public.review_moderation_events set action = 'remove'
    where review_id = '14b00000-0000-4000-8000-000000000007'$$,
  '42501', null,
  'N13: an Administrator cannot update the moderation log directly'
);

select throws_ok(
  $$delete from public.review_moderation_events
    where review_id = '14b00000-0000-4000-8000-000000000007'$$,
  '42501', null,
  'N13: an Administrator cannot delete from the moderation log directly'
);

select throws_ok(
  $$update public.review_reports set outcome = 'dismissed', closed_by = 'a0000000-0000-4000-8000-000000000001', closed_at = now()
    where id = '14c00000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'N13: an Administrator cannot edit a report directly'
);

select throws_ok(
  $$delete from public.review_reports
    where id = '14c00000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'N13: an Administrator cannot delete a report directly'
);

select results_eq(
  $$select count(*)::integer from public.review_moderation_events
    where review_id = '14b00000-0000-4000-8000-000000000007'$$,
  $$values (1)$$,
  'N14: an Administrator reads the moderation log'
);

select is(
  pg_temp.refusal($$select * from public.admin_review_queue('all')$$),
  'P0001 invalid_list',
  'admin_review_queue refuses an unknown list name'
);

select is(
  pg_temp.refusal($$select * from public.admin_review_queue(null)$$),
  'P0001 invalid_list',
  'admin_review_queue refuses a null list name'
);

select results_eq(
  $$select review_id from public.admin_review_queue('reported')
    where space_id in ('14e00000-0000-4000-8000-000000000001', '14e00000-0000-4000-8000-000000000002')$$,
  $$values ('14b00000-0000-4000-8000-000000000003'::uuid),
           ('14b00000-0000-4000-8000-000000000001'::uuid),
           ('14b00000-0000-4000-8000-000000000002'::uuid),
           ('14b00000-0000-4000-8000-000000000006'::uuid)$$,
  'admin_review_queue lists reported reviews oldest open report first, Pending Spaces included'
);

select results_eq(
  $$select space_name, space_status, author_full_name, open_report_count, jsonb_array_length(reports),
           reports->0->>'reporter_full_name', reports->0->>'reason', (reports->0->>'review_version')::integer
    from public.admin_review_queue('reported')
    where review_id = '14b00000-0000-4000-8000-000000000001'$$,
  $$values ('Moderation Test Hall', 'verified'::public.space_status, 'Sam Dela Cruz', 2, 2,
            'Rina Bautista', 'spam', 1)$$,
  'admin_review_queue returns full author and reporter names, space status, open count and ordered reports'
);

select results_eq(
  $$select space_status from public.admin_review_queue('reported')
    where review_id = '14b00000-0000-4000-8000-000000000006'$$,
  $$values ('pending'::public.space_status)$$,
  'admin_review_queue returns space_status pending for a review on a Pending Space'
);

-- Baseline averages on SM before moderation: R1(5), R2(1), R3(3), R4(4), R5(2) => count 5, avg 3.0.
select results_eq(
  $$select review_count, round(avg_overall, 2)
    from public.space_review_summary(array['14e00000-0000-4000-8000-000000000001'::uuid])$$,
  $$values (5, 3.00)$$,
  'baseline: SM has 5 visible reviews with overall average 3.00'
);

-- ---------------------------------------------------------------------------
-- 3. RV4: hide a reported review, leaves averages, reports close as hidden
-- ---------------------------------------------------------------------------
select results_eq(
  $$select (res->>'status')::text, (res->>'action')::text, (res->>'closed_reports')::integer
    from public.moderate_review('14b00000-0000-4000-8000-000000000001', 'hide', 1) as res$$,
  $$values ('hidden', 'hide', 2)$$,
  'RV4: an Administrator hides a reported review and closes both open reports'
);

select results_eq(
  $$select status, status_changed_by, status_changed_at is not null, version, edited_at is null
    from public.reviews where id = '14b00000-0000-4000-8000-000000000001'$$,
  $$values ('hidden'::public.review_status, 'a0000000-0000-4000-8000-000000000001'::uuid, true, 1, true)$$,
  'RV4: hiding sets status, status_changed_by and status_changed_at without changing version or edited_at'
);

select results_eq(
  $$select outcome, closed_by, closed_at is not null
    from public.review_reports
    where review_id = '14b00000-0000-4000-8000-000000000001'
    order by id$$,
  $$values ('hidden'::public.review_report_outcome, 'a0000000-0000-4000-8000-000000000001'::uuid, true),
           ('hidden'::public.review_report_outcome, 'a0000000-0000-4000-8000-000000000001'::uuid, true)$$,
  'RP2: hiding closes every open report as hidden with closed_by and closed_at'
);

-- SM without R1(5): R2(1), R3(3), R4(4), R5(2) => count 4, avg 2.50.
select results_eq(
  $$select review_count, round(avg_overall, 2)
    from public.space_review_summary(array['14e00000-0000-4000-8000-000000000001'::uuid])$$,
  $$values (4, 2.50)$$,
  'RV4: a hidden review leaves the Space''s averages'
);

select is_empty(
  $$select review_id from public.admin_review_queue('reported')
    where review_id = '14b00000-0000-4000-8000-000000000001'$$,
  'RV4: a hidden review leaves the Reported list'
);

select results_eq(
  $$select status_changed_by_full_name, open_report_count, reports->0->>'outcome', reports->1->>'outcome'
    from public.admin_review_queue('hidden')
    where review_id = '14b00000-0000-4000-8000-000000000001'$$,
  $$values ('Alma Reyes', 0, 'hidden', 'hidden')$$,
  'RV4: the hidden review appears in the Hidden list with who hid it and its closed reports'
);

select results_eq(
  $$select action, actor_id from public.review_moderation_events
    where review_id = '14b00000-0000-4000-8000-000000000001'$$,
  $$values ('hide'::public.review_moderation_action, 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'hiding adds a hide row to the moderation log with who took it'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000001', 'hide', 1)$$),
  'P0001 not_allowed',
  'N8: an Administrator cannot hide a review that is already hidden'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000001', 'dismiss', 1)$$),
  'P0001 not_allowed',
  'N8: an Administrator cannot dismiss a hidden review'
);

-- ---------------------------------------------------------------------------
-- 4. RV5: remove a reported review (closes open reports across versions v1 & v2)
-- ---------------------------------------------------------------------------
select results_eq(
  $$select (res->>'status')::text, (res->>'action')::text, (res->>'closed_reports')::integer
    from public.moderate_review('14b00000-0000-4000-8000-000000000002', 'remove', 2) as res$$,
  $$values ('removed', 'remove', 2)$$,
  'RV5: an Administrator removes a reported review and closes open reports across versions'
);

select results_eq(
  $$select review_version, outcome, closed_by
    from public.review_reports
    where review_id = '14b00000-0000-4000-8000-000000000002'
    order by review_version$$,
  $$values (1, 'removed'::public.review_report_outcome, 'a0000000-0000-4000-8000-000000000001'::uuid),
           (2, 'removed'::public.review_report_outcome, 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'RP2: removing closes open reports from both v1 and v2 as removed'
);

-- SM without R1(5) and R2(1): R3(3), R4(4), R5(2) => count 3, avg 3.00.
select results_eq(
  $$select review_count, round(avg_overall, 2)
    from public.space_review_summary(array['14e00000-0000-4000-8000-000000000001'::uuid])$$,
  $$values (3, 3.00)$$,
  'RV5: a removed review leaves the Space''s averages'
);

select results_eq(
  $$select status, status_changed_by_full_name, open_report_count,
           (reports->0->>'review_version')::integer, reports->0->>'outcome',
           (reports->1->>'review_version')::integer, reports->1->>'outcome'
    from public.admin_review_queue('removed')
    where review_id = '14b00000-0000-4000-8000-000000000002'$$,
  $$values ('removed'::public.review_status, 'Alma Reyes', 0, 1, 'removed', 2, 'removed')$$,
  'RV5: the removed review appears in the Removed list with who removed it and its closed reports'
);

select results_eq(
  $$select action, actor_id from public.review_moderation_events
    where review_id = '14b00000-0000-4000-8000-000000000002'$$,
  $$values ('remove'::public.review_moderation_action, 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'removing adds a remove row to the moderation log with who took it'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000002', 'restore', 2)$$),
  'P0001 not_allowed',
  'N8: an Administrator cannot restore a removed review'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000002', 'hide', 2)$$),
  'P0001 not_allowed',
  'N8: an Administrator cannot hide a removed review'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000002', 'remove', 2)$$),
  'P0001 not_allowed',
  'N8: an Administrator cannot remove a removed review again'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000002', 'dismiss', 2)$$),
  'P0001 not_allowed',
  'N8: an Administrator cannot dismiss a removed review'
);

-- ---------------------------------------------------------------------------
-- 5. RV6: dismiss a review's reports (stays visible, leaves Reported, no status_changed)
-- ---------------------------------------------------------------------------
select results_eq(
  $$select (res->>'status')::text, (res->>'action')::text, (res->>'closed_reports')::integer
    from public.moderate_review('14b00000-0000-4000-8000-000000000003', 'dismiss', 1) as res$$,
  $$values ('visible', 'dismiss', 1)$$,
  'RV6: an Administrator dismisses a review''s open reports'
);

select results_eq(
  $$select status, status_changed_by is null, status_changed_at is null
    from public.reviews where id = '14b00000-0000-4000-8000-000000000003'$$,
  $$values ('visible'::public.review_status, true, true)$$,
  'RV6: dismissing leaves the review visible and leaves status_changed_by and status_changed_at untouched'
);

select results_eq(
  $$select outcome, closed_by, closed_at is not null
    from public.review_reports where id = '14c00000-0000-4000-8000-000000000001'$$,
  $$values ('dismissed'::public.review_report_outcome, 'a0000000-0000-4000-8000-000000000001'::uuid, true)$$,
  'RP2: dismissing closes open reports as dismissed'
);

select is_empty(
  $$select review_id from public.admin_review_queue('reported')
    where review_id = '14b00000-0000-4000-8000-000000000003'$$,
  'RV6: a review whose reports were dismissed leaves the Reported list'
);

select results_eq(
  $$select review_count, round(avg_overall, 2)
    from public.space_review_summary(array['14e00000-0000-4000-8000-000000000001'::uuid])$$,
  $$values (3, 3.00)$$,
  'RV6: dismissing reports keeps the review in the Space''s averages'
);

select results_eq(
  $$select action, actor_id from public.review_moderation_events
    where review_id = '14b00000-0000-4000-8000-000000000003'$$,
  $$values ('dismiss'::public.review_moderation_action, 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'dismissing adds a dismiss row to the moderation log'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000003', 'dismiss', 1)$$),
  'P0001 not_allowed',
  'N8: an Administrator cannot dismiss a review with no open reports'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000003', 'restore', 1)$$),
  'P0001 not_allowed',
  'N8: an Administrator cannot restore a visible review'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000003', null, 1)$$),
  'P0001 not_allowed',
  'N8: a null moderation action is refused'
);

-- ---------------------------------------------------------------------------
-- 6. RV7: restore a hidden review (counts in averages again, reports stay closed)
-- ---------------------------------------------------------------------------
select results_eq(
  $$select (res->>'status')::text, (res->>'action')::text, (res->>'closed_reports')::integer
    from public.moderate_review('14b00000-0000-4000-8000-000000000001', 'restore', 1) as res$$,
  $$values ('visible', 'restore', 0)$$,
  'RV7: an Administrator restores a hidden review'
);

-- SM with R1(5) restored alongside R3(3), R4(4), R5(2) => count 4, sum 14, avg 3.50.
select results_eq(
  $$select review_count, round(avg_overall, 2)
    from public.space_review_summary(array['14e00000-0000-4000-8000-000000000001'::uuid])$$,
  $$values (4, 3.50)$$,
  'RV7: a restored review counts in the Space''s averages again'
);

select results_eq(
  $$select distinct outcome from public.review_reports
    where review_id = '14b00000-0000-4000-8000-000000000001'$$,
  $$values ('hidden'::public.review_report_outcome)$$,
  'RV7: restoring a hidden review leaves its earlier reports closed'
);

select is_empty(
  $$select review_id from public.admin_review_queue('hidden')
    where review_id = '14b00000-0000-4000-8000-000000000001'$$,
  'RV7: a restored review leaves the Hidden list'
);

select is_empty(
  $$select review_id from public.admin_review_queue('reported')
    where review_id = '14b00000-0000-4000-8000-000000000001'$$,
  'RV7: a restored review with no new open reports does not re-enter the Reported list'
);

-- ---------------------------------------------------------------------------
-- 7. RV8: hide again, test Hidden ordering, remove from hidden, test Removed ordering & log
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.moderate_review('14b00000-0000-4000-8000-000000000001', 'hide', 1)$$,
  'an Administrator can hide R1 a second time (after restore)'
);

-- admin2 hides R6 (on Pending Space) AFTER R1, so R6 is more recently hidden than R1 (and R7).
set local request.jwt.claims =
  '{"sub": "14d00000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select (res->>'status')::text, (res->>'closed_reports')::integer
    from public.moderate_review('14b00000-0000-4000-8000-000000000006', 'hide', 1) as res$$,
  $$values ('hidden', 1)$$,
  'a second Administrator hides a reported review on a Pending Space'
);

select results_eq(
  $$select review_id from public.admin_review_queue('hidden')
    where space_id in ('14e00000-0000-4000-8000-000000000001', '14e00000-0000-4000-8000-000000000002')$$,
  $$values ('14b00000-0000-4000-8000-000000000006'::uuid),
           ('14b00000-0000-4000-8000-000000000001'::uuid),
           ('14b00000-0000-4000-8000-000000000007'::uuid)$$,
  'admin_review_queue lists hidden reviews most recently hidden first'
);

-- Switch back to Alma (admin) and remove hidden R1 (RV8).
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select (res->>'status')::text, (res->>'action')::text, (res->>'closed_reports')::integer
    from public.moderate_review('14b00000-0000-4000-8000-000000000001', 'remove', 1) as res$$,
  $$values ('removed', 'remove', 0)$$,
  'RV8: an Administrator removes a hidden review'
);

select results_eq(
  $$select review_id from public.admin_review_queue('removed')
    where space_id in ('14e00000-0000-4000-8000-000000000001', '14e00000-0000-4000-8000-000000000002')$$,
  $$values ('14b00000-0000-4000-8000-000000000001'::uuid),
           ('14b00000-0000-4000-8000-000000000002'::uuid)$$,
  'admin_review_queue lists removed reviews most recently removed first'
);

select results_eq(
  $$select action from public.review_moderation_events
    where review_id = '14b00000-0000-4000-8000-000000000001'
    order by created_at asc$$,
  $$values ('hide'::public.review_moderation_action),
           ('restore'::public.review_moderation_action),
           ('hide'::public.review_moderation_action),
           ('remove'::public.review_moderation_action)$$,
  'the moderation log keeps every action on R1 in order (hide, restore, hide, remove)'
);

select results_eq(
  $$select distinct outcome from public.review_reports
    where review_id = '14b00000-0000-4000-8000-000000000001'$$,
  $$values ('hidden'::public.review_report_outcome)$$,
  'RV8: removing a hidden review does not overwrite reports already closed as hidden'
);

-- ---------------------------------------------------------------------------
-- 8. N9 (stale_version) and not_found (author edited or deleted review)
-- ---------------------------------------------------------------------------
-- Sam edits R4 -> version becomes 2.
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

update public.reviews set comment = 'Updated outlets note.'
where id = '14b00000-0000-4000-8000-000000000004';

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000004', 'hide', 1)$$),
  'P0001 stale_version',
  'N9: an Administrator cannot moderate a review edited since they read it'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000004', 'hide', null)$$),
  'P0001 stale_version',
  'N9: a null version is refused as stale_version'
);

select is_empty(
  $$select id from public.review_moderation_events
    where review_id = '14b00000-0000-4000-8000-000000000004'$$,
  'a refused moderation leaves no row in the moderation log'
);

-- Sam deletes R4 (RV3), then Admin tries to moderate it.
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

delete from public.reviews where id = '14b00000-0000-4000-8000-000000000004';

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.moderate_review('14b00000-0000-4000-8000-000000000004', 'hide', 2)$$),
  'P0001 not_found',
  'an Administrator cannot moderate a review its author has deleted'
);

select is(
  pg_temp.refusal($$select public.moderate_review('14b99999-0000-4000-8000-000000000099', 'hide', 1)$$),
  'P0001 not_found',
  'an Administrator cannot moderate a review id that does not exist'
);

-- ---------------------------------------------------------------------------
-- 9. Pagination and clamping on admin_review_queue (500 -> 101, -5 -> 0)
-- ---------------------------------------------------------------------------
set local role postgres;

-- 105 hidden reviews on SQ, #1 hidden most recently (1 minute ago), #105 oldest.
insert into public.reservations (
  id, seeker_id, space_id, unit_label, status, wait_window,
  payment_window_ends_at, checked_in_at, checked_out_at, ended_at
)
select
  ('14a10000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  '14d00000-0000-4000-8000-000000000003', '14e00000-0000-4000-8000-000000000003',
  'Q1', 'completed', interval '60 minutes',
  now() - interval '10 days', now() - interval '10 days', now() - interval '9 days',
  now() - interval '9 days'
from generate_series(1, 105) as i;

insert into public.reviews (
  id, reservation_id, space_id, author_id,
  quietness, wifi_reliability, cleanliness, comfort,
  status, status_changed_by, status_changed_at, created_at
)
select
  ('14b10000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  ('14a10000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  '14e00000-0000-4000-8000-000000000003', '14d00000-0000-4000-8000-000000000003',
  3, 3, 3, 3,
  'hidden', 'a0000000-0000-4000-8000-000000000001',
  now() - make_interval(mins => i),
  now() - interval '9 days'
from generate_series(1, 105) as i;

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select count(*)::integer from public.admin_review_queue('hidden', 500, -5)$$,
  $$values (101)$$,
  'admin_review_queue clamps a page size of 500 to 101'
);

-- R6 was hidden just now (clock_timestamp()), so it is #1 in the global Hidden queue;
-- negative offset clamps to 0 and starts from the first row.
select results_eq(
  $$select review_id from public.admin_review_queue('hidden', 500, -5)
    with ordinality as t order by t.ordinality limit 1$$,
  $$values ('14b00000-0000-4000-8000-000000000006'::uuid)$$,
  'admin_review_queue clamps a negative offset to 0 and starts from the first row'
);

select results_eq(
  $$select count(*)::integer from public.admin_review_queue('hidden', 0, 0)$$,
  $$values (1)$$,
  'admin_review_queue clamps a page size of 0 to 1'
);

select results_eq(
  $$select review_id from public.admin_review_queue('hidden', 2, 1)$$,
  $$values ('14b10000-0000-4000-8000-000000000001'::uuid),
           ('14b10000-0000-4000-8000-000000000002'::uuid)$$,
  'admin_review_queue pages by size and offset, and returns empty reports array when none exist'
);

select results_eq(
  $$select open_report_count, reports from public.admin_review_queue('hidden', 2, 1)
    where review_id = '14b10000-0000-4000-8000-000000000001'$$,
  $$values (0, '[]'::jsonb)$$,
  'admin_review_queue returns an empty jsonb array when a review has no reports'
);

-- ---------------------------------------------------------------------------
-- 10. Account deletion (on delete set null) and review deletion (on delete cascade)
-- ---------------------------------------------------------------------------
set local role postgres;

select lives_ok(
  $$delete from auth.users where id = '14d00000-0000-4000-8000-000000000001'$$,
  'deleting an Administrator who moderated a review succeeds (on delete set null)'
);

select results_eq(
  $$select action, actor_id is null from public.review_moderation_events
    where review_id = '14b00000-0000-4000-8000-000000000006'$$,
  $$values ('hide'::public.review_moderation_action, true)$$,
  'the moderation log keeps its row with actor_id set to null when that Administrator is deleted'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select status_changed_by is null, status_changed_by_full_name is null
    from public.admin_review_queue('hidden')
    where review_id = '14b00000-0000-4000-8000-000000000006'$$,
  $$values (true, true)$$,
  'admin_review_queue still lists a review whose moderating Administrator was deleted'
);

set local role postgres;
delete from public.reviews where id = '14b00000-0000-4000-8000-000000000007';

select is_empty(
  $$select id from public.review_moderation_events
    where review_id = '14b00000-0000-4000-8000-000000000007'$$,
  'deleting a review cascades and deletes its moderation log rows'
);

select * from finish();
rollback;
