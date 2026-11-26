-- STORY-15, TSK-15.1 and STORY-20, TSK-20.1: Space verification, public.set_space_status,
-- public.resubmit_space, the V6 triggers, the list of changes (space_events), and a
-- take-down's hold cancellations (R13, R14). The cases follow the Space verification
-- flow's tables (docs/flows/space-verification.md, "Every move, and its test" and "Moves
-- nobody may make") and STORY-20's design §4 (docs/design/STORY-20-verification-follow-ups.md).
--
-- Seed accounts and Spaces (supabase/seed.sql):
--   admin   a0000000-0000-4000-8000-000000000001
--   host    b0000000-0000-4000-8000-000000000001  owns e…01 Kapihan Study Hall (verified,
--                                                 07:00 to 22:00, units S1 f…01, S2 f…02),
--                                                 e…02 (pending)
--   host2   b0000000-0000-4000-8000-000000000002  owns e…03 Sulok Co-working (verified, open
--                                                 24 hours, units U1 f…17, U2 f…18, U3 f…19)
--   seeker  c0000000-0000-4000-8000-000000000001
--
-- This file's accounts (20d…): seekers A, B and C, a third Host and a second Administrator.
-- This file's Spaces (e…10 to e…72):
--   10 pending    host   rejected with a reason, edited, resubmitted, then approved
--   20 pending    host   edited, renamed, never decided
--   30 rejected   host   the rejection undone (V9)
--   40 taken_down host   resubmitted (V8)
--   50 rejected   host3  resubmitted, then host3's account deleted
--   60 pending    host   approved by admin2, then admin2's account deleted
--   70 verified   host   given a map pin (V6)
--   71 verified   host   its address changed (V6)
--   72 verified   host   saved unchanged, then its hours edited (V4)
-- Holds (20000000-…NN, payment 21000000-…NN):
--   01 seeker A  Sulok U1     pending_payment   cancelled by the take-down (R13)
--   02 seeker B  Sulok U2     reserved, paid    cancelled by the take-down (R14)
--   03 seeker C  Sulok U3     occupied, paid    keeps running
--   04 seeker A  Kapihan S1   pending_payment   cancelled by rejecting the edited Space (R13)
--   05 seeker B  Kapihan S2   reserved, paid    cancelled by rejecting the edited Space (R14)

begin;
create extension if not exists pgtap with schema extensions;
select plan(107);

-- pgTAP's throws_ok sees an error's code and message, but not its hint, and the app tells
-- one refusal from another by the hint. This runs a statement as the current role and
-- returns '<code> <hint>' for the error it raises.
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
-- Fixtures, as postgres
-- ---------------------------------------------------------------------------
set local role postgres;

insert into auth.users (instance_id, id, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '20d00000-0000-4000-8000-000000000001',
   'seeker-a.verification@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Ana Takedown"}'),
  ('00000000-0000-0000-0000-000000000000', '20d00000-0000-4000-8000-000000000002',
   'seeker-b.verification@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Ben Takedown"}'),
  ('00000000-0000-0000-0000-000000000000', '20d00000-0000-4000-8000-000000000003',
   'seeker-c.verification@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Cora Takedown"}'),
  ('00000000-0000-0000-0000-000000000000', '20d00000-0000-4000-8000-000000000004',
   'host3.verification@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "host", "full_name": "Dino Resubmit"}'),
  ('00000000-0000-0000-0000-000000000000', '20d00000-0000-4000-8000-000000000005',
   'admin2.verification@example.test', '{"provider": "email", "providers": ["email"]}',
   '{"role": "seeker", "full_name": "Ella Approver"}');

-- Nobody signs up as an Administrator (STORY-03), so admin2 is made one here.
update public.profiles set role = 'admin' where id = '20d00000-0000-4000-8000-000000000005';

insert into public.spaces
  (id, host_id, name, description, address, opens_at, closes_at, status, status_reason)
values
  ('e0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001',
   'Rejection Candidate Desk', 'A space to be rejected.',
   '50 Test Street, Cebu City', '08:00', '17:00', 'pending', null),
  ('e0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000001',
   'Edit Candidate Desk', 'A pending space to be edited by its host.',
   '51 Test Street, Cebu City', '09:00', '18:00', 'pending', null),
  ('e0000000-0000-4000-8000-000000000030', 'b0000000-0000-4000-8000-000000000001',
   'Undo Candidate Desk', 'A rejected space whose rejection is undone.',
   '52 Test Street, Cebu City', '08:00', '17:00', 'rejected', 'The photos show another building.'),
  ('e0000000-0000-4000-8000-000000000040', 'b0000000-0000-4000-8000-000000000001',
   'Taken Down Desk', 'A taken down space its host resubmits.',
   '53 Test Street, Cebu City', '08:00', '17:00', 'taken_down', 'Seekers reported it closed for good.'),
  ('e0000000-0000-4000-8000-000000000050', '20d00000-0000-4000-8000-000000000004',
   'Third Host Desk', 'A rejected space of the third Host.',
   '54 Test Street, Cebu City', '08:00', '17:00', 'rejected', 'The address is incomplete.'),
  ('e0000000-0000-4000-8000-000000000060', 'b0000000-0000-4000-8000-000000000001',
   'Second Admin Desk', 'A pending space the second Administrator approves.',
   '55 Test Street, Cebu City', '08:00', '17:00', 'pending', null),
  ('e0000000-0000-4000-8000-000000000070', 'b0000000-0000-4000-8000-000000000001',
   'Pinless Desk', 'A verified space with no map pin yet.',
   '56 Test Street, Cebu City', '08:00', '17:00', 'verified', null),
  ('e0000000-0000-4000-8000-000000000071', 'b0000000-0000-4000-8000-000000000001',
   'Moving Desk', 'A verified space whose address changes.',
   '57 Test Street, Cebu City', '08:00', '17:00', 'verified', null);

-- Inserted with its pin: an update that adds one would already send it back to Pending (V6).
insert into public.spaces
  (id, host_id, name, description, address, opens_at, closes_at, status, latitude, longitude)
values
  ('e0000000-0000-4000-8000-000000000072', 'b0000000-0000-4000-8000-000000000001',
   'Steady Desk', 'A verified space saved unchanged.',
   '58 Test Street, Cebu City', '08:00', '17:00', 'verified', 10.3157, 123.8854);

-- Holds 01 to 03 on Sulok, which is open 24 hours, so no closing time lapses them.
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, wait_window_ends_at, booking_token, checked_in_at
) values
  ('20000000-0000-4000-8000-000000000001', '20d00000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000017', 'U1',
   'pending_payment', interval '60 minutes', now() + interval '10 minutes', null, null, null),
  ('20000000-0000-4000-8000-000000000002', '20d00000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000018', 'U2',
   'reserved', interval '60 minutes', now() - interval '5 minutes', now() + interval '55 minutes',
   'TKDN00000002', null),
  ('20000000-0000-4000-8000-000000000003', '20d00000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000019', 'U3',
   'occupied', interval '60 minutes', now() - interval '40 minutes', now() + interval '10 minutes',
   'TKDN00000003', now() - interval '20 minutes');

insert into public.payments (
  id, reservation_id, status, fee_amount, checkout_session_id, checkout_url,
  external_payment_id, paid_at
) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'pending', 5000, 'cs_test_20_01', 'https://checkout.stripe.test/c/pay/cs_test_20_01', null, null),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
   'paid', 5000, 'cs_test_20_02', null, 'pi_test_20_02', now() - interval '6 minutes'),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003',
   'paid', 5000, 'cs_test_20_03', null, 'pi_test_20_03', now() - interval '41 minutes');

-- ---------------------------------------------------------------------------
-- 1. A signed-out visitor (N4)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000002'::uuid, 'verified'::public.space_status, now())$$,
  '42501',
  null,
  'a signed-out visitor cannot run set_space_status'
);

select throws_ok(
  $$select public.resubmit_space('e0000000-0000-4000-8000-000000000030'::uuid)$$,
  '42501',
  null,
  'a signed-out visitor cannot run resubmit_space'
);

-- ---------------------------------------------------------------------------
-- 2. A Seeker (N3, N11)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000002'::uuid, 'verified'::public.space_status, now())$$,
  '42501',
  null,
  'a Seeker cannot approve or reject a Space'
);

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000003'::uuid, 'taken_down'::public.space_status, now(), 'No reason')$$,
  '42501',
  null,
  'a Seeker cannot take a Space down'
);

select throws_ok(
  $$select public.resubmit_space('e0000000-0000-4000-8000-000000000030'::uuid)$$,
  '42501',
  null,
  'a Seeker and an Administrator cannot resubmit a Space (the Seeker)'
);

-- ---------------------------------------------------------------------------
-- 3. A Host (N3, N2)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000002'::uuid, 'verified'::public.space_status, now())$$,
  '42501',
  null,
  'a Host cannot approve or reject a Space, their own included'
);

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000003'::uuid, 'rejected'::public.space_status, now(), 'Not mine')$$,
  '42501',
  null,
  'a Host cannot reject another Host''s Space'
);

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000001'::uuid, 'taken_down'::public.space_status, now(), 'My own')$$,
  '42501',
  null,
  'a Host cannot take down, undo or put back a Space, their own included (take down)'
);

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000030'::uuid, 'verified'::public.space_status, now())$$,
  '42501',
  null,
  'a Host cannot take down, undo or put back a Space, their own included (undo)'
);

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000040'::uuid, 'verified'::public.space_status, now())$$,
  '42501',
  null,
  'a Host cannot take down, undo or put back a Space, their own included (put back)'
);

select throws_ok(
  $$update public.spaces set status_reason = 'I fixed it'
    where id = 'e0000000-0000-4000-8000-000000000030'$$,
  '42501',
  null,
  'a Host cannot write their Space''s reason directly'
);

select throws_ok(
  $$update public.spaces set status_changed_at = now() - interval '1 year'
    where id = 'e0000000-0000-4000-8000-000000000020'$$,
  '42501',
  null,
  'a Host cannot move their Space up the queue by writing status_changed_at'
);

select throws_ok(
  $$insert into public.spaces (name, address, opens_at, closes_at, status_reason)
    values ('Reasoned Desk', '1 Nowhere Road', '08:00', '17:00', 'Pre-reasoned')$$,
  '42501',
  null,
  'a Host cannot set a reason when creating a Space'
);

-- ---------------------------------------------------------------------------
-- 4. An Administrator: direct writes (N2, N6, N14) and refusals (N5, N9, N10)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$update public.spaces set status = 'verified' where id = 'e0000000-0000-4000-8000-000000000002'$$,
  '42501',
  null,
  'an Administrator cannot write status directly'
);

select throws_ok(
  $$update public.spaces set status_reason = 'Direct'
    where id = 'e0000000-0000-4000-8000-000000000030'$$,
  '42501',
  null,
  'an Administrator cannot write a reason directly'
);

select is_empty(
  $$update public.spaces set name = 'Admin Direct Update'
    where id = 'e0000000-0000-4000-8000-000000000001' returning id$$,
  'an Administrator updating a Host''s space affects 0 rows'
);

select is(
  pg_temp.refusal($$select public.set_space_status('e0000000-0000-4000-8000-000000000999'::uuid, 'verified'::public.space_status, now())$$),
  'P0001 not_found',
  'an Administrator cannot decide a Space that does not exist'
);

select is(
  pg_temp.refusal($$select public.set_space_status(null::uuid, 'verified'::public.space_status, now())$$),
  'P0001 not_found',
  'an Administrator cannot decide a Space with a null id'
);

select is(
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid, 'verified'::public.space_status, null)$$),
  'P0001 stale_version',
  'an Administrator cannot decide a Space when passing a null updated_at timestamp'
);

select is(
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'verified'::public.space_status,
      (select updated_at - interval '1 second' from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'))$$),
  'P0001 stale_version',
  'an Administrator cannot decide a Space that changed since they read it'
);

select is(
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'pending'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'))$$),
  'P0001 invalid_transition',
  'an Administrator cannot send a Space to Pending'
);

select is(
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      null,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'))$$),
  'P0001 invalid_transition',
  'an Administrator cannot set status to null'
);

select is(
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000001'::uuid,
      'rejected'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000001'),
      'A reason')$$),
  'P0001 invalid_transition',
  'an Administrator cannot reject a Verified Space'
);

select is(
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000001'::uuid,
      'verified'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000001'))$$),
  'P0001 invalid_transition',
  'an Administrator cannot approve a Verified Space'
);

select is(
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'taken_down'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'),
      'A reason')$$)
  || ', ' ||
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000030'::uuid,
      'taken_down'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000030'),
      'A reason')$$)
  || ', ' ||
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000040'::uuid,
      'taken_down'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000040'),
      'A reason')$$),
  'P0001 invalid_transition, P0001 invalid_transition, P0001 invalid_transition',
  'an Administrator cannot take down a Pending, Rejected or Taken down Space'
);

select is(
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000010'::uuid,
      'rejected'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'))$$)
  || ', ' ||
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000010'::uuid,
      'rejected'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'),
      e'  \n\t ')$$)
  || ', ' ||
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000003'::uuid,
      'taken_down'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000003'),
      '')$$),
  'P0001 invalid_reason, P0001 invalid_reason, P0001 invalid_reason',
  'an Administrator cannot reject or take down a Space without a reason'
);

select is(
  pg_temp.refusal(format(
    $$select public.set_space_status(
        'e0000000-0000-4000-8000-000000000010'::uuid,
        'rejected'::public.space_status,
        (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'),
        %L)$$,
    repeat('x', 501))),
  'P0001 invalid_reason',
  'a reason longer than 500 characters is refused'
);

select results_eq(
  $$select status, status_reason from public.spaces
    where id in ('e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000010')
    order by id$$,
  $$values ('verified'::public.space_status, null::text), ('pending'::public.space_status, null::text)$$,
  'a refused move changes nothing'
);

select throws_ok(
  $$insert into public.space_events (space_id, from_status, to_status)
    values ('e0000000-0000-4000-8000-000000000001', 'verified', 'pending')$$,
  '42501',
  null,
  'nobody can write to the list of changes directly (insert)'
);

-- ---------------------------------------------------------------------------
-- 5. V2: an Administrator approves a Pending Space
-- ---------------------------------------------------------------------------
select results_eq(
  $$select r->>'status', jsonb_array_length(r->'cancelled_holds')
    from public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'verified'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'),
      'An ignored reason'
    ) as r$$,
  $$values ('verified'::text, 0)$$,
  'an Administrator approves a Pending Space, and the move cancels no holds'
);

select results_eq(
  $$select status, status_reason, status_changed_by from public.spaces
    where id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values ('verified'::public.space_status, null::text, 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'the approved Space is verified, with no reason, moved by the Administrator'
);

select results_eq(
  $$select from_status, to_status, reason, actor_id from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values ('pending'::public.space_status, 'verified'::public.space_status, null::text,
            'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'approving a Space adds it to the list of changes'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$select id from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values ('e0000000-0000-4000-8000-000000000002'::uuid)$$,
  'an Administrator approves a Pending Space, and a signed-out visitor can read it'
);

-- ---------------------------------------------------------------------------
-- 6. V3: an Administrator rejects a Pending Space, with a reason
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000010'::uuid,
      'rejected'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'),
      e'  The photos show a different building.\n ')$$,
  'an Administrator rejects a Pending Space'
);

select results_eq(
  $$select status, status_reason, status_changed_by from public.spaces
    where id = 'e0000000-0000-4000-8000-000000000010'$$,
  $$values ('rejected'::public.space_status, 'The photos show a different building.'::text,
            'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'the rejected Space keeps the trimmed reason and who rejected it'
);

select results_eq(
  $$select from_status, to_status, reason from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000010'$$,
  $$values ('pending'::public.space_status, 'rejected'::public.space_status,
            'The photos show a different building.'::text)$$,
  'rejecting a Space adds it, with its reason, to the list of changes'
);

select is(
  pg_temp.refusal($$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000010'::uuid,
      'rejected'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'),
      'Again')$$),
  'P0001 invalid_transition',
  'an Administrator cannot reject a Rejected Space again'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select id from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'$$,
  'an Administrator rejects a Pending Space, and a Seeker still cannot read it'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty(
  $$select id from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'$$,
  'a Seeker and a signed-out visitor cannot read a Rejected Space'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select status, status_reason from public.spaces
    where id = 'e0000000-0000-4000-8000-000000000010'$$,
  $$values ('rejected'::public.space_status, 'The photos show a different building.'::text)$$,
  'an Administrator rejects a Pending Space with a reason, and its Host reads it'
);

-- ---------------------------------------------------------------------------
-- 7. V4: a Host's edit leaves a Space that isn't Verified as it was
-- ---------------------------------------------------------------------------
select results_eq(
  $$update public.spaces set name = 'Edited Pending Desk'
    where id = 'e0000000-0000-4000-8000-000000000020' returning status$$,
  $$values ('pending'::public.space_status)$$,
  'a Host''s edit leaves a Pending Space as it was'
);

select results_eq(
  $$update public.spaces set description = 'Now with better photos.'
    where id = 'e0000000-0000-4000-8000-000000000010' returning status$$,
  $$values ('rejected'::public.space_status)$$,
  'a Host''s edit leaves a Pending or a Rejected Space as it was'
);

select results_eq(
  $$update public.spaces set name = 'Renamed Taken Down Desk'
    where id = 'e0000000-0000-4000-8000-000000000040' returning status, status_reason$$,
  $$values ('taken_down'::public.space_status, 'Seekers reported it closed for good.'::text)$$,
  'a Host''s edit leaves a Taken down Space as it was'
);

-- A rename is in the list of changes whatever the status (D-086). Read as the database
-- owner: a Host can't read the list (N13).
reset role;

select results_eq(
  $$select from_status, to_status, old_name, new_name, old_address, new_address, actor_id
    from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000020'$$,
  $$values (null::public.space_status, null::public.space_status,
            'Edit Candidate Desk'::text, 'Edited Pending Desk'::text, null::text, null::text,
            'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'a Host''s rename of a Pending Space is in its list of changes, with no move'
);

-- ---------------------------------------------------------------------------
-- 8. N11 and V8: resubmitting
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.resubmit_space('e0000000-0000-4000-8000-000000000020'::uuid)$$)
  || ', ' ||
  pg_temp.refusal($$select public.resubmit_space('e0000000-0000-4000-8000-000000000001'::uuid)$$),
  'P0001 not_resubmittable, P0001 not_resubmittable',
  'a Host cannot resubmit a Pending or a Verified Space'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.resubmit_space('e0000000-0000-4000-8000-000000000010'::uuid)$$,
  '42501',
  null,
  'a Host cannot resubmit another Host''s Space'
);

select throws_ok(
  $$select public.resubmit_space('e0000000-0000-4000-8000-000000000999'::uuid)$$,
  '42501',
  null,
  'resubmitting a Space that does not exist reads like another Host''s'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.resubmit_space('e0000000-0000-4000-8000-000000000010'::uuid)$$,
  '42501',
  null,
  'a Seeker and an Administrator cannot resubmit a Space (the Administrator)'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select r->>'status' from public.resubmit_space('e0000000-0000-4000-8000-000000000010'::uuid) as r$$,
  $$values ('pending'::text)$$,
  'a Host resubmits their Rejected Space'
);

select results_eq(
  $$select status, status_reason, status_changed_by from public.spaces
    where id = 'e0000000-0000-4000-8000-000000000010'$$,
  $$values ('pending'::public.space_status, 'The photos show a different building.'::text,
            'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'a resubmitted Space is Pending, keeps its reason, and was moved by its Host'
);

-- The queue's mark comes from the newest entry that made the Space Pending (design §2).
reset role;

select results_eq(
  $$select from_status, actor_id from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000010' and to_status = 'pending'
    order by created_at desc, id desc limit 1$$,
  $$values ('rejected'::public.space_status, 'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'a Host resubmits their Rejected Space, and it returns to Pending, marked Resubmitted, with its reason'
);

select ok(
  (select status_changed_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010')
    > (select status_changed_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000020'),
  'a resubmitted Space waits in the queue from its resubmission, not from its creation'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select r->>'status' from public.resubmit_space('e0000000-0000-4000-8000-000000000040'::uuid) as r$$,
  $$values ('pending'::text)$$,
  'a Host resubmits their Taken down Space'
);

select results_eq(
  $$select status, status_reason from public.spaces where id = 'e0000000-0000-4000-8000-000000000040'$$,
  $$values ('pending'::public.space_status, 'Seekers reported it closed for good.'::text)$$,
  'a resubmitted Taken down Space is Pending and keeps its reason'
);

-- ---------------------------------------------------------------------------
-- 9. N12, N13: the reason is cleared on approval; the list of changes is for Administrators
-- ---------------------------------------------------------------------------
select is_empty(
  $$select id from public.space_events where space_id = 'e0000000-0000-4000-8000-000000000010'$$,
  'a Host and a Seeker read 0 rows of the list of changes, their own Space''s included (the Host)'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty(
  $$select id from public.space_events$$,
  'a Host and a Seeker read 0 rows of the list of changes, their own Space''s included (the Seeker)'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select id from public.space_events$$,
  '42501',
  null,
  'a signed-out visitor cannot read the list of changes'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select from_status, to_status from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000010'
    order by created_at, id$$,
  $$values ('pending'::public.space_status, 'rejected'::public.space_status),
           ('rejected'::public.space_status, 'pending'::public.space_status)$$,
  'an Administrator reads a Space''s list of changes, oldest first here'
);

select lives_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000010'::uuid,
      'verified'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'))$$,
  'an Administrator approves a resubmitted Space'
);

select results_eq(
  $$select status, status_reason from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'$$,
  $$values ('verified'::public.space_status, null::text)$$,
  'a Space''s reason is cleared when it becomes Verified'
);

select throws_ok(
  $$update public.space_events set reason = 'Rewritten'
    where space_id = 'e0000000-0000-4000-8000-000000000010'$$,
  '42501',
  null,
  'nobody can write to the list of changes directly (update)'
);

select throws_ok(
  $$delete from public.space_events where space_id = 'e0000000-0000-4000-8000-000000000010'$$,
  '42501',
  null,
  'nobody can write to the list of changes directly (delete)'
);

-- ---------------------------------------------------------------------------
-- 10. V9: an Administrator undoes a rejection
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000030'::uuid,
      'verified'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000030'),
      'Ignored on an undo')$$,
  'an Administrator undoes a rejection'
);

select results_eq(
  $$select s.status, s.status_reason, e.from_status, e.to_status, e.reason
    from public.spaces s
    join public.space_events e on e.space_id = s.id
    where s.id = 'e0000000-0000-4000-8000-000000000030'$$,
  $$values ('verified'::public.space_status, null::text, 'rejected'::public.space_status,
            'verified'::public.space_status, null::text)$$,
  'an undone rejection clears the reason, and the undo is in the list of changes'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$select id from public.spaces where id = 'e0000000-0000-4000-8000-000000000030'$$,
  $$values ('e0000000-0000-4000-8000-000000000030'::uuid)$$,
  'an Administrator undoes a rejection, and a signed-out visitor can read the Space'
);

-- ---------------------------------------------------------------------------
-- 11. V7, R13, R14: an Administrator takes Sulok down
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000003'::uuid,
      'taken_down'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000003'),
      'My own Space')$$,
  '42501',
  null,
  'a Host cannot take their own Verified Space down'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select h->>'reservation_id', h->>'previous_status', h->>'payment_id',
           h->>'payment_status', h->>'checkout_session_id', h->>'payment_intent_id'
    from jsonb_array_elements((
      select public.set_space_status(
        'e0000000-0000-4000-8000-000000000003'::uuid,
        'taken_down'::public.space_status,
        (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000003'),
        'Seekers reported the space closed for renovation.'
      ) -> 'cancelled_holds'
    )) as h
    order by 1$$,
  $$values
    ('20000000-0000-4000-8000-000000000001'::text, 'pending_payment'::text,
     '21000000-0000-4000-8000-000000000001'::text, 'pending'::text, 'cs_test_20_01'::text, null::text),
    ('20000000-0000-4000-8000-000000000002'::text, 'reserved'::text,
     '21000000-0000-4000-8000-000000000002'::text, 'paid'::text, 'cs_test_20_02'::text,
     'pi_test_20_02'::text)$$,
  'a take-down returns the holds it cancelled, with each one''s payment and checkout'
);

select results_eq(
  $$select status, status_reason, status_changed_by from public.spaces
    where id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values ('taken_down'::public.space_status,
            'Seekers reported the space closed for renovation.'::text,
            'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'an Administrator takes a Verified Space down with a reason'
);

select results_eq(
  $$select from_status, to_status, reason from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values ('verified'::public.space_status, 'taken_down'::public.space_status,
            'Seekers reported the space closed for renovation.'::text)$$,
  'a take-down is in the list of changes, with its reason'
);

reset role;

select results_eq(
  $$select r.id, r.status, r.cancelled_by_take_down, r.ended_at is not null, p.status
    from public.reservations r
    join public.payments p on p.reservation_id = r.id
    where r.id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
    order by r.id$$,
  $$values
    ('20000000-0000-4000-8000-000000000001'::uuid, 'cancelled'::public.reservation_status, true, true,
     'pending'::public.payment_status),
    ('20000000-0000-4000-8000-000000000002'::uuid, 'cancelled'::public.reservation_status, true, true,
     'paid'::public.payment_status)$$,
  'a take-down cancels the Space''s unpaid and paid holds'
);

select ok(
  private.is_refundable('21000000-0000-4000-8000-000000000002'),
  'a take-down leaves the paid fee refundable through STORY-14''s refund (P1)'
);

select results_eq(
  $$select status, cancelled_by_take_down, ended_at from public.reservations
    where id = '20000000-0000-4000-8000-000000000003'$$,
  $$values ('occupied'::public.reservation_status, false, null::timestamptz)$$,
  'a visit under way keeps running after a take-down'
);

select throws_ok(
  $$update public.reservations set cancelled_by_take_down = true
    where id = '20000000-0000-4000-8000-000000000003'$$,
  '23514',
  null,
  'only a cancelled hold can be marked as ended by a take-down'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "20d00000-0000-4000-8000-000000000002", "role": "authenticated"}';

select results_eq(
  $$select status, payment_status, cancelled_by_take_down
    from public.my_reservation('20000000-0000-4000-8000-000000000002'::uuid)$$,
  $$values ('cancelled'::public.reservation_status, 'paid'::public.payment_status, true)$$,
  'the Seeker''s hold page reads that a take-down ended their hold'
);

select is_empty(
  $$select id from public.spaces where id = 'e0000000-0000-4000-8000-000000000003'$$,
  'an Administrator takes a Verified Space down with a reason, and a Seeker cannot read it'
);

select is_empty(
  $$select unit_id from public.unit_states('e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'unit_states returns 0 rows for a Taken down Space, except to its Host and Administrators (a Seeker)'
);

select is_empty(
  $$select fee_amount from public.hold_terms('e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'hold_terms returns nothing for a Taken down Space'
);

select is(
  pg_temp.refusal($$select public.hold_unit('f0000000-0000-4000-8000-000000000017'::uuid, 60)$$),
  'P0001 unit_not_found',
  'a Seeker cannot hold a unit in a Taken down Space'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty(
  $$select id from public.spaces where id = 'e0000000-0000-4000-8000-000000000003'$$,
  'a Seeker and a signed-out visitor cannot read a Taken down Space'
);

select is_empty(
  $$select unit_id from public.unit_states('e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'unit_states returns 0 rows for a Taken down Space, except to its Host and Administrators (a signed-out visitor)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  (select count(*) from public.unit_states('e0000000-0000-4000-8000-000000000003'::uuid)),
  3::bigint,
  'unit_states returns 0 rows for a Taken down Space, except to its Host and Administrators (its Host)'
);

select is(
  (select count(*) from public.hold_terms('e0000000-0000-4000-8000-000000000003'::uuid)),
  1::bigint,
  'hold_terms still answers a Taken down Space''s own Host'
);

select results_eq(
  $$select status, status_reason from public.spaces where id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values ('taken_down'::public.space_status, 'Seekers reported the space closed for renovation.'::text)$$,
  'a Host reads the reason their Space was taken down'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select count(*) from public.unit_states('e0000000-0000-4000-8000-000000000003'::uuid)),
  3::bigint,
  'unit_states returns 0 rows for a Taken down Space, except to its Host and Administrators (an Administrator)'
);

-- ---------------------------------------------------------------------------
-- 12. V10: an Administrator puts Sulok back
-- ---------------------------------------------------------------------------
select results_eq(
  $$select r->>'status', jsonb_array_length(r->'cancelled_holds')
    from public.set_space_status(
      'e0000000-0000-4000-8000-000000000003'::uuid,
      'verified'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000003')
    ) as r$$,
  $$values ('verified'::text, 0)$$,
  'an Administrator puts a Taken down Space back'
);

reset role;

select results_eq(
  $$select s.status, s.status_reason,
           (select array_agg(r.status order by r.id) from public.reservations r
            where r.id in ('20000000-0000-4000-8000-000000000001',
                           '20000000-0000-4000-8000-000000000002',
                           '20000000-0000-4000-8000-000000000003'))
    from public.spaces s where s.id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values ('verified'::public.space_status, null::text,
            array['cancelled', 'cancelled', 'occupied']::public.reservation_status[])$$,
  'an Administrator puts a Taken down Space back, and the holds its take-down cancelled stay cancelled'
);

select results_eq(
  $$select from_status, to_status from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000003'
    order by created_at, id$$,
  $$values ('verified'::public.space_status, 'taken_down'::public.space_status),
           ('taken_down'::public.space_status, 'verified'::public.space_status)$$,
  'putting a Space back is in the list of changes'
);

-- ---------------------------------------------------------------------------
-- 13. V6: a Host changes a Verified Space's name, address or map pin
-- ---------------------------------------------------------------------------
-- Holds 04 and 05 on Kapihan. Seekers A and B are free since the take-down.
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, wait_window_ends_at, booking_token
) values
  ('20000000-0000-4000-8000-000000000004', '20d00000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'S1',
   'pending_payment', interval '30 minutes', now() + interval '10 minutes', null, null),
  ('20000000-0000-4000-8000-000000000005', '20d00000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'S2',
   'reserved', interval '30 minutes', now() - interval '2 minutes', now() + interval '28 minutes',
   'TKDN00000005');

insert into public.payments (
  id, reservation_id, status, fee_amount, checkout_session_id, external_payment_id, paid_at
) values
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004',
   'pending', 5000, 'cs_test_20_04', null, null),
  ('21000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005',
   'paid', 5000, 'cs_test_20_05', 'pi_test_20_05', now() - interval '3 minutes');

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$update public.spaces
    set name = name, address = address, latitude = latitude, longitude = longitude
    where id = 'e0000000-0000-4000-8000-000000000072' returning status$$,
  $$values ('verified'::public.space_status)$$,
  'saving a Verified Space with the same name, address and pin keeps it Verified'
);

select results_eq(
  $$update public.spaces set opens_at = '07:00', description = 'Steady, now from seven.'
    where id = 'e0000000-0000-4000-8000-000000000072' returning status$$,
  $$values ('verified'::public.space_status)$$,
  'a Verified Space''s hours and description edit keeps it Verified'
);

select results_eq(
  $$update public.spaces set name = 'Kapihan Study Hall & Cafe'
    where id = 'e0000000-0000-4000-8000-000000000001' returning status, status_changed_by$$,
  $$values ('pending'::public.space_status, 'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'a Host''s change to a Verified Space''s name sends it back to Pending'
);

select results_eq(
  $$update public.spaces set address = '57 Moved Street, Cebu City'
    where id = 'e0000000-0000-4000-8000-000000000071' returning status$$,
  $$values ('pending'::public.space_status)$$,
  'a Host''s change to a Verified Space''s address sends it back to Pending'
);

select results_eq(
  $$update public.spaces set latitude = 10.3301, longitude = 123.9058
    where id = 'e0000000-0000-4000-8000-000000000070' returning status$$,
  $$values ('pending'::public.space_status)$$,
  'a Host adding a map pin to a Verified Space sends it back to Pending'
);

reset role;

select results_eq(
  $$select from_status, to_status, old_name, new_name, actor_id from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values ('verified'::public.space_status, 'pending'::public.space_status,
            'Kapihan Study Hall'::text, 'Kapihan Study Hall & Cafe'::text,
            'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'a Host''s change to a Verified Space''s name, address or pin sends it back to Pending, marked Edited'
);

select results_eq(
  $$select from_status, to_status, old_latitude, new_latitude, old_longitude, new_longitude,
           old_name, old_address
    from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000070'$$,
  $$values ('verified'::public.space_status, 'pending'::public.space_status,
            null::double precision, 10.3301::double precision,
            null::double precision, 123.9058::double precision, null::text, null::text)$$,
  'a new map pin is in the list of changes, with both coordinates'
);

select results_eq(
  $$select old_address, new_address from public.space_events
    where space_id = 'e0000000-0000-4000-8000-000000000071'$$,
  $$values ('57 Test Street, Cebu City'::text, '57 Moved Street, Cebu City'::text)$$,
  'a new address is in the list of changes, old and new'
);

select is_empty(
  $$select id from public.space_events where space_id = 'e0000000-0000-4000-8000-000000000072'$$,
  'an unchanged save, or an hours or description edit, adds nothing to the list of changes'
);

select is(
  (select status_changed_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000001'),
  (select created_at from public.space_events where space_id = 'e0000000-0000-4000-8000-000000000001'),
  'an edited Space waits in the queue from its edit, the time its entry carries'
);

select results_eq(
  $$select status from public.reservations
    where id in ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005')
    order by id$$,
  $$values ('pending_payment'::public.reservation_status), ('reserved'::public.reservation_status)$$,
  'a Verified Space sent back to Pending by an edit keeps its holds running'
);

-- ---------------------------------------------------------------------------
-- 14. V3 after V6: rejecting the edited Kapihan cancels its holds
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select h->>'reservation_id', h->>'previous_status', h->>'payment_status', h->>'payment_intent_id'
    from jsonb_array_elements((
      select public.set_space_status(
        'e0000000-0000-4000-8000-000000000001'::uuid,
        'rejected'::public.space_status,
        (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000001'),
        'The new name doesn''t match the sign outside.'
      ) -> 'cancelled_holds'
    )) as h
    order by 1$$,
  $$values
    ('20000000-0000-4000-8000-000000000004'::text, 'pending_payment'::text, 'pending'::text, null::text),
    ('20000000-0000-4000-8000-000000000005'::text, 'reserved'::text, 'paid'::text, 'pi_test_20_05'::text)$$,
  'rejecting an edited Space returns the holds it cancelled'
);

reset role;

select results_eq(
  $$select status, cancelled_by_take_down from public.reservations
    where id in ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005')
    order by id$$,
  $$values ('cancelled'::public.reservation_status, true), ('cancelled'::public.reservation_status, true)$$,
  'rejecting an edited Space cancels its unpaid and paid holds'
);

-- ---------------------------------------------------------------------------
-- 15. Deleted accounts: the list of changes goes with its Space, and outlives its actor
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "20d00000-0000-4000-8000-000000000004", "role": "authenticated"}';

select lives_ok(
  $$select public.resubmit_space('e0000000-0000-4000-8000-000000000050'::uuid)$$,
  'the third Host resubmits their Rejected Space'
);

set local request.jwt.claims =
  '{"sub": "20d00000-0000-4000-8000-000000000005", "role": "authenticated"}';

select lives_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000060'::uuid,
      'verified'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000060'))$$,
  'the second Administrator approves a Space'
);

reset role;

delete from auth.users where id in (
  '20d00000-0000-4000-8000-000000000004',
  '20d00000-0000-4000-8000-000000000005'
);

select is(
  (select count(*) from public.space_events where space_id = 'e0000000-0000-4000-8000-000000000050')
    + (select count(*) from public.spaces where id = 'e0000000-0000-4000-8000-000000000050'),
  0::bigint,
  'deleting a Host''s account deletes their Space and its list of changes'
);

select results_eq(
  $$select s.status, s.status_changed_by, e.to_status, e.actor_id
    from public.spaces s
    join public.space_events e on e.space_id = s.id
    where s.id = 'e0000000-0000-4000-8000-000000000060'$$,
  $$values ('verified'::public.space_status, null::uuid, 'verified'::public.space_status, null::uuid)$$,
  'deleting an Administrator''s account keeps their decisions, with no one named'
);

-- ---------------------------------------------------------------------------
-- 16. The schema: the reason's checks and the Realtime publication
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.spaces set status_reason = 'Stale reason'
    where id = 'e0000000-0000-4000-8000-000000000002'$$,
  '23514',
  null,
  'a Verified Space cannot carry a reason, even written by the database owner'
);

select throws_ok(
  $$update public.spaces set status_reason = '   '
    where id = 'e0000000-0000-4000-8000-000000000020'$$,
  '23514',
  null,
  'a stored reason cannot be blank'
);

select ok(
  not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  or exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spaces'
  ),
  'spaces is in the supabase_realtime publication, for the live notice (D-086)'
);

select * from finish();
rollback;
