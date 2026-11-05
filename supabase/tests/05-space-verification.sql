-- STORY-15, TSK-15.1: Space verification (approve or reject) and public.set_space_status.
-- The cases follow the design's §4 matrix (docs/design/STORY-15-space-verification.md)
-- and the Space verification flow (docs/flows/space-verification.md).
-- Uses accounts and spaces from supabase/seed.sql:
--   admin  a0000000-0000-4000-8000-000000000001
--   host   b0000000-0000-4000-8000-000000000001  owns e…01 (verified), e…02 (pending)
--   host2  b0000000-0000-4000-8000-000000000002  owns e…03 (verified)
--   seeker c0000000-0000-4000-8000-000000000001

begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Pre-seed test spaces as postgres (bypassing RLS) for isolated Move V3, V4, and concurrency tests.
insert into public.spaces (id, host_id, name, description, address, opens_at, closes_at, status)
values
  ('e0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001',
   'Rejection Candidate Desk', 'A space to be rejected.',
   '50 Test Street, Cebu City', '08:00', '17:00', 'pending'),
  ('e0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000001',
   'Edit Candidate Desk', 'A pending space to be edited by its host.',
   '51 Test Street, Cebu City', '09:00', '18:00', 'pending');

-- ---------------------------------------------------------------------------
-- 1. An anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000002'::uuid, 'verified'::public.space_status, now())$$,
  '42501',
  null,
  'a signed-out visitor cannot run set_space_status'
);

-- ---------------------------------------------------------------------------
-- 2. A Seeker
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
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000002'::uuid, 'rejected'::public.space_status, now())$$,
  '42501',
  null,
  'a Seeker cannot reject a Space'
);

-- ---------------------------------------------------------------------------
-- 3. A Host
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
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000002'::uuid, 'rejected'::public.space_status, now())$$,
  '42501',
  null,
  'a Host cannot reject their own Space'
);

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000003'::uuid, 'verified'::public.space_status, now())$$,
  '42501',
  null,
  'a Host cannot approve another Host''s Space'
);

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000003'::uuid, 'rejected'::public.space_status, now())$$,
  '42501',
  null,
  'a Host cannot reject another Host''s Space'
);

-- ---------------------------------------------------------------------------
-- 4. An Administrator: direct write denials & validation refusals
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$update public.spaces set status = 'verified' where id = 'e0000000-0000-4000-8000-000000000002'$$,
  '42501',
  null,
  'an Administrator cannot write status directly'
);

select is_empty(
  $$update public.spaces set name = 'Admin Direct Update'
    where id = 'e0000000-0000-4000-8000-000000000001' returning id$$,
  'an Administrator updating a Host''s space affects 0 rows'
);

select throws_ok(
  $$select public.set_space_status('e0000000-0000-4000-8000-000000000999'::uuid, 'verified'::public.space_status, now())$$,
  'P0001',
  null,
  'an Administrator cannot decide a Space that does not exist'
);

select throws_ok(
  $$select public.set_space_status(null::uuid, 'verified'::public.space_status, now())$$,
  'P0001',
  null,
  'an Administrator cannot decide a Space with a null id'
);

select throws_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'pending'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000002')
    )$$,
  'P0001',
  null,
  'an Administrator cannot set status to pending'
);

select throws_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      null,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000002')
    )$$,
  'P0001',
  null,
  'an Administrator cannot set status to null'
);

select throws_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'verified'::public.space_status,
      null
    )$$,
  'P0001',
  null,
  'an Administrator cannot decide a Space when passing a null updated_at timestamp'
);

select throws_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'verified'::public.space_status,
      (select updated_at - interval '1 second' from public.spaces where id = 'e0000000-0000-4000-8000-000000000002')
    )$$,
  'P0001',
  null,
  'an Administrator cannot decide a Space that changed since they read it'
);

select throws_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000001'::uuid,
      'verified'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000001')
    )$$,
  'P0001',
  null,
  'an Administrator cannot move a Verified or a Rejected Space'
);

select throws_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000001'::uuid,
      'rejected'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000001')
    )$$,
  'P0001',
  null,
  'an Administrator cannot move an already verified Space to rejected'
);

-- ---------------------------------------------------------------------------
-- 5. Move V2: Administrator approves a Pending Space
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'verified'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000002')
    )$$,
  'an Administrator approves a Pending Space'
);

select results_eq(
  $$select status from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values ('verified'::public.space_status)$$,
  'the approved Space has status verified'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$select id from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values ('e0000000-0000-4000-8000-000000000002'::uuid)$$,
  'an Administrator approves a Pending Space, and a signed-out visitor can read it'
);

-- ---------------------------------------------------------------------------
-- 6. Move V3: Administrator rejects a Pending Space
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000010'::uuid,
      'rejected'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010')
    )$$,
  'an Administrator rejects a Pending Space'
);

select results_eq(
  $$select status from public.spaces where id = 'e0000000-0000-4000-8000-000000000010'$$,
  $$values ('rejected'::public.space_status)$$,
  'the rejected Space has status rejected'
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
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000010'::uuid,
      'verified'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010')
    )$$,
  'P0001',
  null,
  'an Administrator cannot move a Rejected Space to verified'
);

select throws_ok(
  $$select public.set_space_status(
      'e0000000-0000-4000-8000-000000000010'::uuid,
      'rejected'::public.space_status,
      (select updated_at from public.spaces where id = 'e0000000-0000-4000-8000-000000000010')
    )$$,
  'P0001',
  null,
  'an Administrator cannot move a Rejected Space to rejected'
);

-- ---------------------------------------------------------------------------
-- 7. Move V4: Host edits a Pending or Rejected Space
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$update public.spaces set name = 'Edited Pending Desk'
    where id = 'e0000000-0000-4000-8000-000000000020' returning status$$,
  $$values ('pending'::public.space_status)$$,
  'a Host''s edit leaves a Pending Space as it was'
);

select results_eq(
  $$update public.spaces set name = 'Edited Rejected Desk'
    where id = 'e0000000-0000-4000-8000-000000000010' returning status$$,
  $$values ('rejected'::public.space_status)$$,
  'a Host''s edit leaves a Pending or a Rejected Space as it was'
);

select * from finish();
rollback;
