-- STORY-15, TSK-15.1: space verification function and status comment.
-- Design: docs/design/STORY-15-space-verification.md. Never edit this file once applied;
-- add a new migration instead.

-- Update comment on public.spaces.status (STORY-15, FR-5.1).
comment on column public.spaces.status is
  'Verification status: pending until an Administrator approves or rejects it on /admin (STORY-15, FR-5.1).';

-- Changes a Space's verification status (D-053, D-054).
-- Accessible only by Administrators. Refuses anyone else with 42501.
-- Refuses non-pending spaces (not_pending), invalid target statuses (invalid_target_status),
-- or stale timestamps (stale_version).
create or replace function public.set_space_status(
  p_space_id uuid,
  p_status public.space_status,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.space_status;
  v_updated_at timestamptz;
begin
  if not (select private.has_role('admin')) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('verified', 'rejected') then
    raise exception 'invalid_target_status'
      using errcode = 'P0001', hint = 'invalid_target_status';
  end if;

  select status, updated_at
  into v_status, v_updated_at
  from public.spaces
  where id = p_space_id
  for update;

  if not found or v_status is distinct from 'pending' then
    raise exception 'not_pending'
      using errcode = 'P0001', hint = 'not_pending';
  end if;

  if p_updated_at is null or v_updated_at is distinct from p_updated_at then
    raise exception 'stale_version'
      using errcode = 'P0001', hint = 'stale_version';
  end if;

  update public.spaces
  set status = p_status
  where id = p_space_id
    and status = 'pending';

  if not found then
    raise exception 'not_pending'
      using errcode = 'P0001', hint = 'not_pending';
  end if;
end;
$$;

comment on function public.set_space_status(uuid, public.space_status, timestamptz) is
  'Approves or rejects a pending Space. Accessible only by Administrators. STORY-15 (FR-5.1, D-053).';

revoke all on function public.set_space_status(uuid, public.space_status, timestamptz) from public, anon;
grant execute on function public.set_space_status(uuid, public.space_status, timestamptz) to authenticated;
