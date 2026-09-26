-- Local and CI seed data only (D-013). Never run this against a cloud project:
-- the Administrator account below must never exist there.
-- Invented people, @example.test emails. Every account's password is
-- Worq-demo-2026 (8+ characters, a number and a symbol, per STORY-03's rules).
--
-- Fixed ids so pgTAP tests can act as each account:
--   admin@example.test   a0000000-0000-4000-8000-000000000001  Administrator
--   host@example.test    b0000000-0000-4000-8000-000000000001  Host
--   host2@example.test   b0000000-0000-4000-8000-000000000002  Host
--   seeker@example.test  c0000000-0000-4000-8000-000000000001  Seeker

-- Users go into auth.users, so private.handle_new_user() creates their profiles
-- exactly as a real sign-up would. The token columns must be '' rather than null,
-- or Supabase Auth fails to sign these accounts in.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('Worq-demo-2026', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('role', u.signup_role, 'full_name', u.full_name),
  now(),
  now(),
  '', '', '', ''
from (
  values
    -- The trigger refuses `admin`, so the Administrator signs up as a seeker and
    -- is promoted below.
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@example.test', 'seeker', 'Alma Reyes'),
    ('b0000000-0000-4000-8000-000000000001'::uuid, 'host@example.test', 'host', 'Hugo Santos'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, 'host2@example.test', 'host', 'Hana Villanueva'),
    ('c0000000-0000-4000-8000-000000000001'::uuid, 'seeker@example.test', 'seeker', 'Sam Dela Cruz')
) as u (id, email, signup_role, full_name);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(),
  now(),
  now()
from auth.users as u
where u.email like '%@example.test';

update public.profiles
set role = 'admin'
where id = 'a0000000-0000-4000-8000-000000000001';
