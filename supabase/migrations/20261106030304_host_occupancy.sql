-- STORY-12, TSK-12.1: public.set_unit_state for Host-set states (H2, N12, N13, N24).
-- Design: docs/design/STORY-12-host-occupancy.md. Never edit this file once applied;
-- add a new migration instead.

-- Host occupancy state control function (D-036, D-047).
-- Allows the Space's Host to set a unit's state to 'available', 'reserved', or 'occupied' (Move H2).
-- Refuses non-hosts, callers who do not own the Space, and nonexistent units with 42501 (N13, N24).
-- Rejects 'pending_payment' with 23514 check constraint violation (N12).
-- Updates units.host_updated_at on every call (D-051).
-- Optimistic lock and hold override handling (R5, R9, R11, N14, N21) are added in TSK-12.4.
create or replace function public.set_unit_state(
  p_unit_id uuid,
  p_state text,
  p_expected_reservation_id uuid default null,
  p_expected_reservation_status text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_id uuid;
begin
  -- Lock unit row first (D-047) and verify ownership
  select s.host_id
  into v_host_id
  from public.units u
  join public.spaces s on s.id = u.space_id
  where u.id = p_unit_id
  for update of u;

  if not found or v_host_id is distinct from (select auth.uid()) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- Update unit's host-set state and host_updated_at (H2, D-051)
  -- The check constraint units_host_state_check rejects invalid states and 'pending_payment' with 23514 (N12)
  update public.units
  set host_state = p_state,
      host_updated_at = now()
  where id = p_unit_id;
end;
$$;

comment on function public.set_unit_state(uuid, text, uuid, text) is
  'Sets a unit''s occupancy state or overrides an active hold. STORY-12 (FR-3.2, D-004, D-050).';

revoke all on function public.set_unit_state(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.set_unit_state(uuid, text, uuid, text) to authenticated;
