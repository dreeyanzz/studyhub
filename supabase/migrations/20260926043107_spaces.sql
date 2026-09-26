-- STORY-01, TSK-01.2: spaces and their Row-Level Security.
-- Design: docs/design/STORY-01-database-rls.md. Never edit this file once applied;
-- add a new migration instead.

-- Verification status (FR-5.1). Only an Administrator changes it (STORY-14).
create type public.space_status as enum ('pending', 'verified', 'rejected');

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) >= 1 and char_length(name) <= 100),
  description text check (char_length(description) <= 2000),
  address text not null
    check (char_length(btrim(address)) >= 1 and char_length(address) <= 200),
  -- The same hours every day. closes_at earlier than opens_at means the space
  -- closes after midnight; equal means it is open 24 hours (design §2, D-004).
  opens_at time not null,
  closes_at time not null,
  status public.space_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.spaces is
  'A Host''s study or co-working space. No price, tags or coordinates yet (D-027). STORY-01.';
comment on column public.spaces.status is
  'Verification status. Never granted to hosts, so only an Administrator (STORY-14) changes it.';

-- Policies filter by host_id, and the foreign key needs it for cascades.
create index spaces_host_id_idx on public.spaces (host_id);

create trigger set_updated_at
  before update on public.spaces
  for each row execute function private.set_updated_at();

-- Grants: start from nothing, then give back only what the design's table allows.
-- id, host_id and status are never granted, so setting them fails with 42501
-- whatever the policies say. On insert, host_id defaults to the caller and
-- status to pending.
revoke all on table public.spaces from anon, authenticated;
grant select on table public.spaces to anon, authenticated;
grant insert (name, description, address, opens_at, closes_at)
  on table public.spaces to authenticated;
grant update (name, description, address, opens_at, closes_at)
  on table public.spaces to authenticated;
grant delete on table public.spaces to authenticated;

alter table public.spaces enable row level security;

create policy "spaces: read verified, own, or any as an administrator"
  on public.spaces
  for select
  to anon, authenticated
  using (
    status = 'verified'
    or host_id = (select auth.uid())
    or (select private.has_role('admin'))
  );

create policy "spaces: hosts create their own"
  on public.spaces
  for insert
  to authenticated
  with check (
    (select private.has_role('host'))
    and host_id = (select auth.uid())
  );

create policy "spaces: hosts update their own"
  on public.spaces
  for update
  to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "spaces: hosts delete their own"
  on public.spaces
  for delete
  to authenticated
  using (host_id = (select auth.uid()));
