-- STORY-01, TSK-01.1: profiles, the sign-up trigger and their Row-Level Security.
-- Design: docs/design/STORY-01-database-rls.md. Never edit this file once applied;
-- add a new migration instead.

-- Helpers live in `private`, which the Data API does not expose (config.toml
-- exposes only `public` and `graphql_public`).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create type public.user_role as enum ('seeker', 'host', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'seeker',
  full_name text check (char_length(full_name) <= 100),
  phone_number text check (char_length(phone_number) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth.users row, created by private.handle_new_user(). STORY-01.';
comment on column public.profiles.role is
  'Set by the sign-up trigger, never by the user: it has no update grant.';

-- Keeps updated_at current. Shared with later tables (spaces).
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- True when the caller's own profile has the given role. Security definer so a
-- policy can call it without recursing into the profiles policies. Policies call
-- it as `(select private.has_role(...))` so it runs once per query.
create function private.has_role(wanted public.user_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = wanted
  );
$$;

revoke all on function private.has_role(public.user_role) from public;
grant execute on function private.has_role(public.user_role) to anon, authenticated;

-- Creates the profile for each new auth user. A missing role means seeker;
-- seeker and host are accepted; anything else (including admin) raises, so the
-- sign-up fails and no user is created. Nobody signs themselves up as an
-- Administrator (design §7: a loud failure, not a quiet downgrade).
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'seeker');
begin
  if requested not in ('seeker', 'host') then
    raise exception 'invalid sign-up role: %', requested
      using hint = 'Sign up as seeker or host.';
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    requested::public.user_role,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '')
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Grants: start from nothing, then give back only what the design's table allows.
-- id and role are never granted for update, so changing them fails with 42501
-- whatever the policies say. Nobody may insert or delete directly.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update (full_name, phone_number) on table public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "profiles: read own, or any as an administrator"
  on public.profiles
  for select
  to anon, authenticated
  using (
    id = (select auth.uid())
    or (select private.has_role('admin'))
  );

create policy "profiles: update own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
