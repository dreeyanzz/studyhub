-- STORY-21, TSK-21.1: Google OAuth one-time role confirmation and RLS gate.
-- Flow: docs/flows/google-oauth.md (D-095).
-- Design: docs/design/STORY-21-google-oauth.md.
-- Never edit this file once applied; add a new migration instead.

alter table public.profiles
  add column role_confirmed boolean not null default true;

comment on column public.profiles.role_confirmed is
  'False for a brand-new OAuth account until public.complete_oauth_role confirms Seeker or Host once (D-095). No update grant.';

-- Gate every role check on role_confirmed = true so an unconfirmed OAuth user
-- cannot act as a Seeker, Host or Administrator even if proxy.ts is bypassed (D-007, D-095).
create or replace function private.has_role(wanted public.user_role)
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
      and role_confirmed = true
  );
$$;

revoke all on function private.has_role(public.user_role) from public;
grant execute on function private.has_role(public.user_role) to anon, authenticated;

-- Creates the profile for each new auth user.
-- Email sign-ups accept seeker or host (default seeker) and start confirmed.
-- OAuth sign-ups (server-owned raw_app_meta_data.provider <> 'email') always
-- start unconfirmed with role = 'seeker' until /choose-role runs complete_oauth_role.
-- Display names are trimmed and bounded to 100 characters so long Google names
-- never abort sign-up against profiles.full_name's check constraint (D-095).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  v_requested text;
  v_full_name text := nullif(
    left(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      100
    ),
    ''
  );
begin
  if v_provider <> 'email' then
    insert into public.profiles (id, role, role_confirmed, full_name)
    values (new.id, 'seeker'::public.user_role, false, v_full_name);
    return new;
  end if;

  v_requested := coalesce(new.raw_user_meta_data ->> 'role', 'seeker');
  if v_requested not in ('seeker', 'host') then
    raise exception 'invalid sign-up role: %', v_requested
      using hint = 'Sign up as seeker or host.';
  end if;

  insert into public.profiles (id, role, role_confirmed, full_name)
  values (new.id, v_requested::public.user_role, true, v_full_name);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

-- One-time role and full-name confirmation for brand-new OAuth accounts (D-095).
-- Accepts only seeker or host (never admin, D-013) and refuses once role_confirmed
-- is already true, so confirmed roles remain immutable.
create or replace function public.complete_oauth_role(
  p_role public.user_role,
  p_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trimmed_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_profile record;
begin
  if v_uid is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('seeker', 'host') then
    raise exception 'Invalid role'
      using errcode = 'P0001', hint = 'invalid_role';
  end if;

  if v_trimmed_name is null or char_length(v_trimmed_name) > 100 then
    raise exception 'Invalid full name'
      using errcode = 'P0001', hint = 'invalid_full_name';
  end if;

  select id, role, role_confirmed
  into v_profile
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'Profile not found'
      using errcode = 'P0001', hint = 'profile_not_found';
  end if;

  if v_profile.role_confirmed then
    raise exception 'Role already confirmed'
      using errcode = 'P0001', hint = 'role_already_confirmed';
  end if;

  update public.profiles
  set role = p_role,
      full_name = v_trimmed_name,
      role_confirmed = true
  where id = v_uid;

  return jsonb_build_object('role', p_role);
end;
$$;

comment on function public.complete_oauth_role(public.user_role, text) is
  'Confirms an unconfirmed OAuth account as seeker or host once, saving its full name. STORY-21 (D-095).';

revoke all on function public.complete_oauth_role(public.user_role, text) from public, anon, authenticated;
grant execute on function public.complete_oauth_role(public.user_role, text) to authenticated;
