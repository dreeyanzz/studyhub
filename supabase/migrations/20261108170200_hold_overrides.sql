-- STORY-12, TSK-12.4: the hold override part of public.set_unit_state (R5, R9, R11, N14,
-- N21). Design: docs/design/STORY-12-host-occupancy.md §2. Flow:
-- docs/flows/reservation-lifecycle.md. Never edit this file once applied; add a new
-- migration instead.
--
-- Same signature as TSK-12.1's function (20261106030304_host_occupancy.sql), so the
-- generated types don't change. It keeps H2, N12, N13 and N24, and adds:
--   - the lapse step first (D-047);
--   - locks in one order: the unit, then its active hold, then the hold's payment (D-047);
--   - a held unit changes only when the call names the hold the Host saw, its id and its
--     status (D-050): no hold named is N14 (hold_not_named), a hold that differs from the
--     one named is N21 (hold_changed);
--   - ending the named hold before the Host-set state is written: R5, R9 or R11.
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
  v_reservation_id uuid;
  v_reservation_status public.reservation_status;
  v_names_a_hold boolean;
begin
  -- 1. Record lapses on the unit before reading its hold (D-047). A refusal below rolls
  -- this back with the rest of the call; the next read records it again.
  perform private.record_lapses(array[p_unit_id]);

  -- 2. Lock the unit first (D-047) and check the caller is its Space's Host. A missing
  -- unit reads the same as another Host's (N13). A signed-out visitor never gets here:
  -- the function isn't granted to anon (N24).
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

  -- 3. Lock the unit's active hold, then its payment (D-047). The unique index
  -- reservations_one_active_hold_per_unit allows at most one active hold.
  select r.id, r.status
  into v_reservation_id, v_reservation_status
  from public.reservations r
  where r.unit_id = p_unit_id
    and r.status in ('pending_payment', 'reserved', 'occupied')
  for update;

  if v_reservation_id is not null then
    perform 1
    from public.payments p
    where p.reservation_id = v_reservation_id
    for update;
  end if;

  -- 4. The call must name exactly what the unit has now (D-050). Naming either value
  -- counts as naming a hold; the Server Action's schema sends both or neither.
  v_names_a_hold := p_expected_reservation_id is not null
    or p_expected_reservation_status is not null;

  if v_reservation_id is not null and not v_names_a_hold then
    -- N14: a tap that names no hold never ends one. This is also what a Host gets when a
    -- Seeker held the unit after the Host's page loaded.
    raise exception 'the unit has an active hold the call does not name'
      using errcode = 'P0001', hint = 'hold_not_named';
  end if;

  if v_names_a_hold and (
    v_reservation_id is null
    or p_expected_reservation_id is distinct from v_reservation_id
    or p_expected_reservation_status is distinct from v_reservation_status::text
  ) then
    -- N21: the hold named has been paid, checked in, cancelled or lapsed since the Host
    -- looked, or a different hold is there now.
    raise exception 'the unit''s hold has changed since it was seen'
      using errcode = 'P0001', hint = 'hold_changed';
  end if;

  -- 5. End the named hold (D-050). Its payment is left as it is: a pending fee stays
  -- pending (R5, D-046), and a paid fee stays paid, for an Administrator's refund (R9,
  -- P1) or because the visit happened (R11).
  if v_reservation_id is not null then
    update public.reservations
    set status = case v_reservation_status
          when 'occupied' then 'completed'::public.reservation_status -- R11
          else 'cancelled'::public.reservation_status                 -- R5, R9
        end,
        ended_at = now()
    where id = v_reservation_id;
  end if;

  -- 6. Set the Host-set state and the Host-updated time (H2, D-051), overrides included.
  -- units_host_state_check refuses 'pending_payment' and any other state with 23514
  -- (N12); that error also undoes step 5, so the hold stays as it was.
  update public.units
  set host_state = p_state,
      host_updated_at = now()
  where id = p_unit_id;
end;
$$;

comment on function public.set_unit_state(uuid, text, uuid, text) is
  'Sets a unit''s Host-set state, ending the active hold the call names first. STORY-12 (FR-3.2, D-004, D-047, D-050, D-051).';

-- create or replace keeps the grants; restated so this file says who may call it (N24).
revoke all on function public.set_unit_state(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.set_unit_state(uuid, text, uuid, text) to authenticated;
