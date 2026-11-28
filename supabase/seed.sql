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
--   seeker2@example.test c0000000-0000-4000-8000-000000000002  Seeker

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
    ('c0000000-0000-4000-8000-000000000001'::uuid, 'seeker@example.test', 'seeker', 'Sam Dela Cruz'),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 'seeker2@example.test', 'seeker', 'Rina Bautista')
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

-- Spaces (STORY-01), with fixed ids for pgTAP. The seed sets status directly;
-- in the app only an Administrator changes it on /admin (STORY-15, FR-5.1).
--   e0000000-0000-4000-8000-000000000001  host@   verified  07:00-22:00
--   e0000000-0000-4000-8000-000000000002  host@   pending   18:00-02:00 (after midnight)
--   e0000000-0000-4000-8000-000000000003  host2@  verified  open 24 hours
-- Each has a map pin (STORY-08, FR-1.1) so the discovery map shows them locally: the
-- Kapihan pair share one in Lahug, Sulok sits in IT Park. Approximate barangay points,
-- not real buildings (D-013).
insert into public.spaces (id, host_id, name, description, address, opens_at, closes_at, status, latitude, longitude)
values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Kapihan Study Hall', 'Quiet tables, strong wifi and bottomless brewed coffee.',
   '12 Invented Street, Lahug, Cebu City', '07:00', '22:00', 'verified', 10.3321, 123.8987),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'Kapihan Night Desk', 'The late-night room upstairs, for night owls.',
   '12 Invented Street, Lahug, Cebu City', '18:00', '02:00', 'pending', 10.3321, 123.8987),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   'Sulok Co-working', 'Open desks and two meeting pods, open all day and night.',
   '48 Sample Avenue, IT Park, Cebu City', '00:00', '00:00', 'verified', 10.3302, 123.9060);

-- Zones and units (STORY-07), with fixed ids for pgTAP.
-- Every unit starts with host_state = 'available' (FR-3.1, D-046).
--   Kapihan Study Hall (e...01): "Quiet desks" (S1–S8), "Standing desks" (D1–D4),
--     "Private rooms" (Room A: 3 cells, cap 6; Room B: 2 cells, cap 4)
--   Kapihan Night Desk (e...02, pending): "Night owl desks" (N1–N2)
--   Sulok Co-working (e...03): "Open desks" (U1–U3)
insert into public.zones (id, space_id, name, position)
values
  ('d0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Quiet desks', 0),
  ('d0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Standing desks', 1),
  ('d0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'Private rooms', 2),
  ('d0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 'Night owl desks', 0),
  ('d0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000003', 'Open desks', 0);

insert into public.units (id, space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
values
  -- Kapihan Study Hall: Quiet desks (S1–S8)
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S1', null, 0, 0, 1),
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S2', null, 0, 1, 1),
  ('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S3', null, 0, 2, 1),
  ('f0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S4', null, 0, 3, 1),
  ('f0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S5', null, 0, 4, 1),
  ('f0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S6', null, 0, 5, 1),
  ('f0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S7', null, 1, 0, 1),
  ('f0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'seat', 'S8', null, 1, 1, 1),

  -- Kapihan Study Hall: Standing desks (D1–D4)
  ('f0000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'standing_desk', 'D1', null, 0, 0, 1),
  ('f0000000-0000-4000-8000-000000000010', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'standing_desk', 'D2', null, 0, 1, 1),
  ('f0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'standing_desk', 'D3', null, 0, 2, 1),
  ('f0000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'standing_desk', 'D4', null, 0, 3, 1),

  -- Kapihan Study Hall: Private rooms (Room A: 3 cells, cap 6; Room B: 2 cells, cap 4)
  ('f0000000-0000-4000-8000-000000000013', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'room', 'Room A', 6, 0, 0, 3),
  ('f0000000-0000-4000-8000-000000000014', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'room', 'Room B', 4, 0, 3, 2),

  -- Kapihan Night Desk (pending): Night owl desks (N1–N2)
  ('f0000000-0000-4000-8000-000000000015', 'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 'seat', 'N1', null, 0, 0, 1),
  ('f0000000-0000-4000-8000-000000000016', 'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 'seat', 'N2', null, 0, 1, 1),

  -- Sulok Co-working: Open desks (U1–U3)
  ('f0000000-0000-4000-8000-000000000017', 'e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 'seat', 'U1', null, 0, 0, 1),
  ('f0000000-0000-4000-8000-000000000018', 'e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 'seat', 'U2', null, 0, 1, 1),
  ('f0000000-0000-4000-8000-000000000019', 'e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 'seat', 'U3', null, 0, 2, 1);

-- Demo visits, reviews and an open report (STORY-13, TSK-13.2, design §2 "Seed data").
-- Placed on seeker2@example.test (Rina Bautista) and Kapihan Study Hall standing desks
-- D1 and D2 so tests that delete seeker@example.test's reservations or U1–U3 / S1–S3
-- never cascade-delete these rows (D-081).
--   Reservations:  a1000000-...01 (D1), a1000000-...02 (D2)
--   Payments:      a2000000-...01,      a2000000-...02
--   Reviews:       a3000000-...01 (with comment), a3000000-...02 (no comment)
--   Open report:   a4000000-...01 (by seeker@example.test on a3000000-...01)
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, wait_window_ends_at, booking_token,
  checked_in_at, checked_out_at, ended_at, created_at
)
values
  ('a1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009',
   'D1', 'completed', interval '60 minutes',
   now() - interval '4 days' - interval '2 hours 50 minutes',
   now() - interval '4 days' - interval '1 hour 55 minutes',
   'SEED00000001',
   now() - interval '4 days' - interval '2 hours',
   now() - interval '4 days',
   now() - interval '4 days',
   now() - interval '4 days' - interval '3 hours'),
  ('a1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000010',
   'D2', 'completed', interval '60 minutes',
   now() - interval '2 days' - interval '2 hours 50 minutes',
   now() - interval '2 days' - interval '1 hour 55 minutes',
   'SEED00000002',
   now() - interval '2 days' - interval '2 hours',
   now() - interval '2 days',
   now() - interval '2 days',
   now() - interval '2 days' - interval '3 hours');

insert into public.payments (
  id, reservation_id, status, fee_amount,
  checkout_session_id, external_payment_id, paid_at, created_at
)
select
  p.id,
  p.reservation_id,
  'paid'::public.payment_status,
  s.fee_amount,
  p.checkout_session_id,
  p.external_payment_id,
  p.paid_at,
  p.created_at
from (
  values
    ('a2000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid,
     'cs_seed_visit_01', 'pi_seed_visit_01',
     now() - interval '4 days' - interval '2 hours 55 minutes',
     now() - interval '4 days' - interval '3 hours'),
    ('a2000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid,
     'cs_seed_visit_02', 'pi_seed_visit_02',
     now() - interval '2 days' - interval '2 hours 55 minutes',
     now() - interval '2 days' - interval '3 hours')
) as p (id, reservation_id, checkout_session_id, external_payment_id, paid_at, created_at)
cross join private.reservation_settings as s
where s.id = true;

insert into public.reviews (
  id, reservation_id, space_id, author_id,
  quietness, wifi_reliability, cleanliness, comfort, comment, created_at
)
values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   5, 4, 5, 4,
   'Quiet corner with steady Wi-Fi and plenty of outlets for an afternoon study session.',
   now() - interval '3 days'),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   4, 4, 4, 4,
   null,
   now() - interval '1 day');

insert into public.review_reports (
  id, review_id, reporter_id, reason, note, created_at
)
values
  ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'other',
   'Mentions amenities from an older layout.',
   now() - interval '12 hours');

