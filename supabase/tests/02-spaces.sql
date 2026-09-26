-- STORY-01: spaces and their Row-Level Security.
-- The cases follow the design's §4 matrix (docs/design/STORY-01-database-rls.md).
-- Uses the accounts and spaces from supabase/seed.sql:
--   admin  a0000000-0000-4000-8000-000000000001
--   host   b0000000-0000-4000-8000-000000000001  owns e…01 (verified), e…02 (pending)
--   host2  b0000000-0000-4000-8000-000000000002  owns e…03 (verified)
--   seeker c0000000-0000-4000-8000-000000000001
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- ---------------------------------------------------------------------------
-- An anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$select id from public.spaces order by id$$,
  $$values ('e0000000-0000-4000-8000-000000000001'::uuid),
           ('e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'an anonymous visitor lists verified spaces only'
);

-- ---------------------------------------------------------------------------
-- A Seeker
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select id from public.spaces order by id$$,
  $$values ('e0000000-0000-4000-8000-000000000001'::uuid),
           ('e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'a Seeker lists verified spaces only'
);

select throws_ok(
  $$insert into public.spaces (name, address, opens_at, closes_at)
    values ('Seeker Space', '1 Nowhere Road', '08:00', '17:00')$$,
  '42501',
  null,
  'a Seeker cannot create a space'
);

select is_empty(
  $$update public.spaces set name = 'Taken Over'
    where id = 'e0000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker updating a Host''s space affects 0 rows'
);

select is_empty(
  $$delete from public.spaces
    where id = 'e0000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker deleting a Host''s space affects 0 rows'
);

-- ---------------------------------------------------------------------------
-- An Administrator
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select id from public.spaces order by id$$,
  $$values ('e0000000-0000-4000-8000-000000000001'::uuid),
           ('e0000000-0000-4000-8000-000000000002'::uuid),
           ('e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'an Administrator lists every space, pending included'
);

select throws_ok(
  $$insert into public.spaces (name, address, opens_at, closes_at)
    values ('Admin Space', '1 Nowhere Road', '08:00', '17:00')$$,
  '42501',
  null,
  'an Administrator cannot create a space: only Hosts can'
);

-- ---------------------------------------------------------------------------
-- A Host
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select id from public.spaces order by id$$,
  $$values ('e0000000-0000-4000-8000-000000000001'::uuid),
           ('e0000000-0000-4000-8000-000000000002'::uuid),
           ('e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'a Host lists verified spaces plus their own pending one'
);

select results_eq(
  $$insert into public.spaces (name, address, opens_at, closes_at)
    values ('Kapihan Annex', '14 Invented Street, Lahug, Cebu City', '09:00', '18:00')
    returning status, host_id$$,
  $$values ('pending'::public.space_status, 'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'a Host creates a space: it is pending and belongs to them'
);

select throws_ok(
  $$insert into public.spaces (name, address, opens_at, closes_at, status)
    values ('Pre-verified', '1 Nowhere Road', '08:00', '17:00', 'verified')$$,
  '42501',
  null,
  'a Host cannot set status when creating a space'
);

select throws_ok(
  $$insert into public.spaces (name, address, opens_at, closes_at, host_id)
    values ('Not Mine', '1 Nowhere Road', '08:00', '17:00',
            'b0000000-0000-4000-8000-000000000002')$$,
  '42501',
  null,
  'a Host cannot set host_id when creating a space'
);

select throws_ok(
  $$update public.spaces set status = 'verified'
    where id = 'e0000000-0000-4000-8000-000000000002'$$,
  '42501',
  null,
  'a Host cannot verify their own space'
);

select throws_ok(
  $$update public.spaces set host_id = 'b0000000-0000-4000-8000-000000000002'
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a Host cannot hand their space to another Host'
);

select throws_ok(
  $$insert into public.spaces (name, address, opens_at, closes_at)
    values ('   ', '1 Nowhere Road', '08:00', '17:00')$$,
  '23514',
  null,
  'a space needs a name'
);

select results_eq(
  $$update public.spaces set name = 'Kapihan Study Hall & Cafe'
    where id = 'e0000000-0000-4000-8000-000000000001' returning status$$,
  $$values ('verified'::public.space_status)$$,
  'a Host edits their own verified space, and it stays verified'
);

select isnt_empty(
  $$delete from public.spaces
    where id = 'e0000000-0000-4000-8000-000000000002' returning id$$,
  'a Host deletes their own space'
);

-- ---------------------------------------------------------------------------
-- Another Host
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select results_eq(
  $$select id from public.spaces order by id$$,
  $$values ('e0000000-0000-4000-8000-000000000001'::uuid),
           ('e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'another Host sees neither the first Host''s pending spaces nor the new one'
);

select is_empty(
  $$update public.spaces set name = 'Hijacked'
    where id = 'e0000000-0000-4000-8000-000000000001' returning id$$,
  'another Host updating the Host''s space affects 0 rows'
);

select is_empty(
  $$delete from public.spaces
    where id = 'e0000000-0000-4000-8000-000000000001' returning id$$,
  'another Host deleting the Host''s space affects 0 rows'
);

-- ---------------------------------------------------------------------------
-- Back as the database owner: check what the writes above did
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$select name, status, host_id from public.spaces
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values ('Kapihan Study Hall & Cafe', 'verified'::public.space_status,
            'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'the Host''s space keeps only its owner''s edit'
);

select is(
  (select count(*) from public.spaces where id = 'e0000000-0000-4000-8000-000000000002'),
  0::bigint,
  'the Host''s deleted space is gone'
);

select * from finish();
rollback;
