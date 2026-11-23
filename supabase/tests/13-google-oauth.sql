-- STORY-21, TSK-21.1: Google OAuth role_confirmed, private.has_role gate,
-- private.handle_new_user OAuth handling, and public.complete_oauth_role.
-- Flow: docs/flows/google-oauth.md (G6-G8, O-N1..O-N6, O-N10, O-N11).
-- Design: docs/design/STORY-21-google-oauth.md §4.
--
-- Seed accounts:
--   admin   a0000000-0000-4000-8000-000000000001
--   host    b0000000-0000-4000-8000-000000000001
--   host2   b0000000-0000-4000-8000-000000000002
--   seeker  c0000000-0000-4000-8000-000000000001
--   seeker2 c0000000-0000-4000-8000-000000000002
--   Sulok Co-working (verified, 24h) unit U1: f0000000-0000-4000-8000-000000000017

begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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
-- 1. Existing seeded profiles stay confirmed (role_confirmed = true)
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.profiles where role_confirmed = true),
  5::bigint,
  'all five seeded profiles have role_confirmed = true'
);

-- ---------------------------------------------------------------------------
-- 2. private.handle_new_user() for Google OAuth vs email sign-ups
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, email, raw_app_meta_data, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000000',
    'd1000000-0000-4000-8000-000000000001',
    'oauth-seeker@example.test',
    '{"provider": "google", "providers": ["google"]}',
    '{"full_name": "Gina OAuth"}'
  ),
  (
    '00000000-0000-4000-8000-000000000000',
    'd1000000-0000-4000-8000-000000000002',
    'oauth-host@example.test',
    '{"provider": "google", "providers": ["google"]}',
    '{"name": "Marco NameOnly"}'
  ),
  (
    '00000000-0000-4000-8000-000000000000',
    'd1000000-0000-4000-8000-000000000003',
    'oauth-long@example.test',
    '{"provider": "google", "providers": ["google"]}',
    jsonb_build_object('full_name', '  ' || repeat('A', 120) || '  ')
  ),
  (
    '00000000-0000-4000-8000-000000000000',
    'd1000000-0000-4000-8000-000000000004',
    'oauth-sneaky@example.test',
    '{"provider": "google", "providers": ["google"]}',
    '{"role": "admin", "full_name": "Sneaky Admin"}'
  ),
  (
    '00000000-0000-4000-8000-000000000000',
    'd1000000-0000-4000-8000-000000000005',
    'email-long@example.test',
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('role', 'host', 'full_name', '  ' || repeat('B', 110) || '  ')
  );

select results_eq(
  $$select role, role_confirmed, full_name from public.profiles
    where id = 'd1000000-0000-4000-8000-000000000001'$$,
  $$values ('seeker'::public.user_role, false, 'Gina OAuth')$$,
  'a Google sign-up creates a profile with role_confirmed false and its full_name (G6)'
);

select results_eq(
  $$select role, role_confirmed, full_name from public.profiles
    where id = 'd1000000-0000-4000-8000-000000000002'$$,
  $$values ('seeker'::public.user_role, false, 'Marco NameOnly')$$,
  'a Google sign-up falls back to metadata name when full_name is absent (G6)'
);

select results_eq(
  $$select role_confirmed, char_length(full_name) from public.profiles
    where id = 'd1000000-0000-4000-8000-000000000003'$$,
  $$values (false, 100)$$,
  'a Google display name over 100 characters is truncated to 100 characters on sign-up (O-N10)'
);

select results_eq(
  $$select role, role_confirmed from public.profiles
    where id = 'd1000000-0000-4000-8000-000000000004'$$,
  $$values ('seeker'::public.user_role, false)$$,
  'a Google sign-up ignores raw_user_meta_data role = admin (O-N1)'
);

select results_eq(
  $$select role, role_confirmed, char_length(full_name) from public.profiles
    where id = 'd1000000-0000-4000-8000-000000000005'$$,
  $$values ('host'::public.user_role, true, 100)$$,
  'an email sign-up still starts confirmed with role_confirmed = true'
);

-- ---------------------------------------------------------------------------
-- 3. Signed-out visitor cannot call complete_oauth_role (O-N4)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.complete_oauth_role('seeker', 'Anon Visitor')$$,
  '42501',
  null,
  'a signed-out visitor cannot call complete_oauth_role (O-N4)'
);

-- ---------------------------------------------------------------------------
-- 4. Unconfirmed Google user: RLS and validation boundaries
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "d1000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select id, role_confirmed from public.profiles$$,
  $$values ('d1000000-0000-4000-8000-000000000001'::uuid, false)$$,
  'an unconfirmed Google user reads only their own profile with role_confirmed false'
);

select is(
  (select count(*) from public.profiles
   where id = 'c0000000-0000-4000-8000-000000000001'),
  0::bigint,
  'an unconfirmed Google user reads 0 rows of another user''s profile'
);

select is(
  (select private.has_role('seeker')),
  false,
  'private.has_role returns false while role_confirmed is false (O-N5)'
);

select throws_ok(
  $$update public.profiles set role_confirmed = true
    where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'an authenticated user cannot update role_confirmed directly (O-N3)'
);

select throws_ok(
  $$update public.profiles set role = 'host'
    where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'an unconfirmed user cannot update role directly (O-N3)'
);

select throws_ok(
  $$select * from public.hold_unit('f0000000-0000-4000-8000-000000000017', 30)$$,
  '42501',
  null,
  'an unconfirmed Google user cannot hold a unit (O-N5)'
);

select throws_ok(
  $$insert into public.spaces (name, address, opens_at, closes_at)
    values ('Blocked Space', '1 Test St', '08:00', '20:00')$$,
  '42501',
  null,
  'an unconfirmed Google user cannot create a Space (O-N6)'
);

select is(
  pg_temp.refusal($$select public.complete_oauth_role('admin', 'Gina OAuth')$$),
  'P0001 invalid_role',
  'complete_oauth_role refuses admin role (O-N1)'
);

select is(
  pg_temp.refusal($$select public.complete_oauth_role(null, 'Gina OAuth')$$),
  'P0001 invalid_role',
  'complete_oauth_role refuses null role (O-N1)'
);

select is(
  pg_temp.refusal($$select public.complete_oauth_role('seeker', '   ')$$),
  'P0001 invalid_full_name',
  'complete_oauth_role refuses blank full_name (O-N11)'
);

select is(
  pg_temp.refusal(
    format('select public.complete_oauth_role(''seeker'', %L)', repeat('X', 101))
  ),
  'P0001 invalid_full_name',
  'complete_oauth_role refuses full_name over 100 characters (O-N11)'
);

-- ---------------------------------------------------------------------------
-- 5. One-time confirmation as Seeker unlocks Seeker capabilities and locks role (G7, G8, O-N2)
-- ---------------------------------------------------------------------------
select is(
  public.complete_oauth_role('seeker', '  Gina Santos  '),
  '{"role": "seeker"}'::jsonb,
  'complete_oauth_role confirms an unconfirmed user as seeker and trims full_name (G7)'
);

select results_eq(
  $$select role, role_confirmed, full_name from public.profiles
    where id = 'd1000000-0000-4000-8000-000000000001'$$,
  $$values ('seeker'::public.user_role, true, 'Gina Santos')$$,
  'the confirmed Seeker profile stores role seeker, role_confirmed true and trimmed name'
);

select is(
  (select private.has_role('seeker')),
  true,
  'private.has_role(''seeker'') returns true once confirmed (G7)'
);

select is(
  (select created from public.hold_unit('f0000000-0000-4000-8000-000000000017', 30)),
  true,
  'a confirmed Google Seeker can hold an available unit'
);

select is(
  pg_temp.refusal($$select public.complete_oauth_role('host', 'Gina Santos')$$),
  'P0001 role_already_confirmed',
  'a confirmed Google Seeker cannot switch to host via complete_oauth_role (O-N2)'
);

select is(
  pg_temp.refusal($$select public.complete_oauth_role('seeker', 'Gina Santos')$$),
  'P0001 role_already_confirmed',
  'a second complete_oauth_role call with the same role refuses once confirmed (G8)'
);

-- ---------------------------------------------------------------------------
-- 6. One-time confirmation as Host unlocks Host capabilities and locks role (G7, O-N2)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "d1000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  public.complete_oauth_role('host', 'Marco Reyes'),
  '{"role": "host"}'::jsonb,
  'complete_oauth_role confirms an unconfirmed user as host (G7)'
);

select results_eq(
  $$select role, role_confirmed, full_name from public.profiles
    where id = 'd1000000-0000-4000-8000-000000000002'$$,
  $$values ('host'::public.user_role, true, 'Marco Reyes')$$,
  'the confirmed Host profile stores role host, role_confirmed true and full_name'
);

select is(
  (select private.has_role('host')),
  true,
  'private.has_role(''host'') returns true once confirmed as host (G7)'
);

select is(
  (select private.has_role('seeker')),
  false,
  'private.has_role(''seeker'') returns false for a confirmed Google host'
);

select isnt_empty(
  $$insert into public.spaces (name, address, opens_at, closes_at)
    values ('Marco Study Hall', '22 Sample Rd', '08:00', '22:00')
    returning id$$,
  'a confirmed Google Host can create a Space'
);

select is(
  pg_temp.refusal($$select public.complete_oauth_role('seeker', 'Marco Reyes')$$),
  'P0001 role_already_confirmed',
  'a confirmed Google Host cannot switch to seeker via complete_oauth_role (O-N2)'
);

-- ---------------------------------------------------------------------------
-- 7. Existing confirmed Seeker, Host and Administrator cannot call complete_oauth_role (O-N2)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.complete_oauth_role('host', 'Sam Dela Cruz')$$),
  'P0001 role_already_confirmed',
  'an existing confirmed Seeker cannot change role through complete_oauth_role (O-N2)'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.complete_oauth_role('seeker', 'Hugo Santos')$$),
  'P0001 role_already_confirmed',
  'an existing confirmed Host cannot change role through complete_oauth_role (O-N2)'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.complete_oauth_role('seeker', 'Alma Reyes')$$),
  'P0001 role_already_confirmed',
  'an existing confirmed Administrator cannot change role through complete_oauth_role (O-N2)'
);

select * from finish();
rollback;
