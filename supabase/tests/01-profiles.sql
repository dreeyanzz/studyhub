-- STORY-01: profiles, the sign-up trigger and their Row-Level Security.
-- The cases follow the design's §4 matrix (docs/design/STORY-01-database-rls.md).
-- Uses the accounts from supabase/seed.sql:
--   admin  a0000000-0000-4000-8000-000000000001
--   host   b0000000-0000-4000-8000-000000000001
--   seeker c0000000-0000-4000-8000-000000000001
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- ---------------------------------------------------------------------------
-- An anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select count(*) from public.profiles),
  0::bigint,
  'an anonymous visitor reads 0 profiles'
);

select throws_ok(
  $$update public.profiles set full_name = 'Nobody'$$,
  '42501',
  null,
  'an anonymous visitor cannot update profiles'
);

-- ---------------------------------------------------------------------------
-- A Seeker
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select id from public.profiles$$,
  $$values ('c0000000-0000-4000-8000-000000000001'::uuid)$$,
  'a Seeker reads exactly one profile: their own'
);

select is(
  (select count(*) from public.profiles
   where id = 'b0000000-0000-4000-8000-000000000001'),
  0::bigint,
  'a Seeker reads 0 rows of another user''s profile'
);

select is_empty(
  $$update public.profiles set full_name = 'Taken Over'
    where id = 'b0000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker updating another user''s profile affects 0 rows'
);

select isnt_empty(
  $$update public.profiles set full_name = 'Samantha Dela Cruz', phone_number = '+639170000000'
    where id = 'c0000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker updates their own name and phone number'
);

select throws_ok(
  $$update public.profiles set role = 'admin'
    where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Seeker cannot change their own role'
);

select throws_ok(
  $$update public.profiles set role = 'host'
    where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Seeker cannot make themselves a Host'
);

select throws_ok(
  $$update public.profiles set id = gen_random_uuid()
    where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Seeker cannot change their own id'
);

select throws_ok(
  $$insert into public.profiles (id, role)
    values ('c0000000-0000-4000-8000-000000000001', 'admin')$$,
  '42501',
  null,
  'a Seeker cannot insert a profile directly'
);

select throws_ok(
  $$delete from public.profiles where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Seeker cannot delete a profile directly'
);

-- ---------------------------------------------------------------------------
-- An Administrator
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select count(*) from public.profiles),
  4::bigint,
  'an Administrator reads every profile'
);

select is_empty(
  $$update public.profiles set full_name = 'Moderated'
    where id = 'b0000000-0000-4000-8000-000000000001' returning id$$,
  'an Administrator cannot update another user''s profile either'
);

-- ---------------------------------------------------------------------------
-- Back as the database owner: check what the updates above did
-- ---------------------------------------------------------------------------
reset role;

select is(
  (select full_name from public.profiles where id = 'b0000000-0000-4000-8000-000000000001'),
  'Hugo Santos',
  'the other user''s profile is unchanged'
);

select results_eq(
  $$select role, full_name, phone_number from public.profiles
    where id = 'c0000000-0000-4000-8000-000000000001'$$,
  $$values ('seeker'::public.user_role, 'Samantha Dela Cruz', '+639170000000')$$,
  'the Seeker''s own edit is saved and their role is still seeker'
);

select ok(
  (select updated_at > created_at from public.profiles
   where id = 'c0000000-0000-4000-8000-000000000001'),
  'updating a profile moves updated_at forward'
);

-- ---------------------------------------------------------------------------
-- The sign-up trigger
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000001',
   'new-host@example.test', '{"role": "host", "full_name": "Nina Host"}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000002',
   'new-seeker@example.test', '{"role": "seeker"}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000003',
   'no-role@example.test', '{}');

select results_eq(
  $$select role, full_name from public.profiles
    where id = 'd0000000-0000-4000-8000-000000000001'$$,
  $$values ('host'::public.user_role, 'Nina Host')$$,
  'signing up as a Host creates a host profile with the given name'
);

select is(
  (select role from public.profiles where id = 'd0000000-0000-4000-8000-000000000002'),
  'seeker'::public.user_role,
  'signing up as a Seeker creates a seeker profile'
);

select is(
  (select role from public.profiles where id = 'd0000000-0000-4000-8000-000000000003'),
  'seeker'::public.user_role,
  'signing up with no role creates a seeker profile'
);

select throws_ok(
  $$insert into auth.users (instance_id, id, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000004',
            'sneaky@example.test', '{"role": "admin"}')$$,
  'P0001',
  'invalid sign-up role: admin',
  'signing up as an Administrator raises'
);

select is(
  (select count(*) from auth.users where id = 'd0000000-0000-4000-8000-000000000004'),
  0::bigint,
  'the refused Administrator sign-up leaves no user'
);

select throws_ok(
  $$insert into auth.users (instance_id, id, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000005',
            'odd@example.test', '{"role": "owner"}')$$,
  'P0001',
  'invalid sign-up role: owner',
  'signing up with an unknown role raises'
);

select is(
  (select count(*) from public.profiles
   where id in ('d0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000005')),
  0::bigint,
  'refused sign-ups leave no profile'
);

select * from finish();
rollback;
