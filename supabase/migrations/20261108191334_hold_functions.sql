-- STORY-09, TSK-09.2: hold_terms, hold_unit, cancel_hold.
-- Design: docs/design/STORY-09-reserve-now-holds.md §2.
-- Flows: docs/flows/reservation-lifecycle.md, docs/flows/sandbox-payment-confirmation.md.
-- Never edit this file once applied; add a new migration instead.

-- 1. public.hold_terms(space_id)
create or replace function public.hold_terms(p_space_id uuid)
returns table (
  fee_amount integer,
  payment_window_minutes integer,
  max_wait_window_minutes integer,
  is_open boolean,
  next_closing_at timestamptz,
  wait_window_minutes integer[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_space_status public.space_status;
  v_host_id uuid;
  v_opens_at time;
  v_closes_at time;
  v_max_wait_window interval;
  v_fee_amount integer;
  v_payment_window interval;
  v_payment_window_minutes integer;
  v_max_wait_window_minutes integer;
  v_now timestamptz;
  v_is_open boolean;
  v_next_closing timestamptz;
  v_wait_windows integer[];
begin
  select s.status, s.host_id, s.opens_at, s.closes_at, s.max_wait_window
  into v_space_status, v_host_id, v_opens_at, v_closes_at, v_max_wait_window
  from public.spaces s
  where s.id = p_space_id;

  if not found then
    return;
  end if;

  -- Pending or Rejected Spaces are visible only to their Host and Administrators (D-055, N19)
  if v_space_status in ('pending', 'rejected') then
    if (select auth.uid()) is distinct from v_host_id and not (select private.has_role('admin')) then
      return;
    end if;
  end if;

  select s.fee_amount, s.payment_window
  into v_fee_amount, v_payment_window
  from private.reservation_settings s
  limit 1;

  v_payment_window_minutes := round(extract(epoch from v_payment_window) / 60)::integer;
  v_max_wait_window_minutes := round(extract(epoch from v_max_wait_window) / 60)::integer;
  v_now := clock_timestamp();
  v_is_open := private.is_open(v_opens_at, v_closes_at, v_now);
  v_next_closing := private.next_closing_time(v_opens_at, v_closes_at, v_now);

  if v_is_open then
    select coalesce(array_agg(w order by w), '{}')
    into v_wait_windows
    from unnest(array[15, 30, 45, 60, 75, 90, 105, 120]) as w
    where w <= v_max_wait_window_minutes
      and (v_next_closing is null or v_now + v_payment_window + (w * interval '1 minute') <= v_next_closing);
  else
    v_wait_windows := '{}'::integer[];
  end if;

  return query
  select
    v_fee_amount,
    v_payment_window_minutes,
    v_max_wait_window_minutes,
    v_is_open,
    v_next_closing,
    v_wait_windows;
end;
$$;

comment on function public.hold_terms(uuid) is
  'Hold terms, allowed wait windows and closing time for a Space. STORY-09 (D-048, D-055, D-067).';

revoke all on function public.hold_terms(uuid) from public, anon, authenticated;
grant execute on function public.hold_terms(uuid) to anon, authenticated;

-- 2. public.hold_unit(unit_id, wait_window_minutes)
create or replace function public.hold_unit(
  p_unit_id uuid,
  p_wait_window_minutes integer
)
returns table (
  reservation_id uuid,
  status public.reservation_status,
  checkout_url text,
  created boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller_held_units uuid[];
  v_units_to_lapse uuid[];
  v_unit record;
  v_space record;
  v_existing_res_id uuid;
  v_existing_status public.reservation_status;
  v_existing_checkout_url text;
  v_payment_window interval;
  v_fee_amount integer;
  v_wait_interval interval;
  v_now timestamptz;
  v_next_closing timestamptz;
  v_payment_window_ends_at timestamptz;
  v_new_reservation_id uuid;
  v_new_status public.reservation_status;
  v_constraint_name text;
begin
  -- 1. Refuses with 42501 unless caller is a Seeker (N5)
  if not (select private.has_role('seeker')) then
    raise exception 'Only Seeker accounts can hold units.'
      using errcode = '42501';
  end if;

  -- 2. Records lapses for the unit, and for the caller's own hold (D-008, D-047)
  select coalesce(array_agg(distinct r.unit_id), '{}')
  into v_caller_held_units
  from public.reservations r
  where r.seeker_id = (select auth.uid())
    and r.status in ('pending_payment', 'reserved', 'occupied');

  v_units_to_lapse := array(
    select distinct u
    from unnest(array_append(v_caller_held_units, p_unit_id)) as u
    where u is not null
  );

  if array_length(v_units_to_lapse, 1) > 0 then
    perform private.record_lapses(v_units_to_lapse);
  end if;

  -- 3. Locks the unit. If caller already holds this unit, returns that hold unchanged (W2)
  select u.id, u.space_id, u.label, u.host_state
  into v_unit
  from public.units u
  where u.id = p_unit_id
  for update;

  if v_unit.id is not null then
    select r.id, r.status, p.checkout_url
    into v_existing_res_id, v_existing_status, v_existing_checkout_url
    from public.reservations r
    left join public.payments p on p.reservation_id = r.id
    where r.unit_id = p_unit_id
      and r.seeker_id = (select auth.uid())
      and r.status in ('pending_payment', 'reserved', 'occupied');

    if found then
      return query select v_existing_res_id, v_existing_status, v_existing_checkout_url, false;
      return;
    end if;
  end if;

  -- 4. Refuses with P0001 and one of these hints, in this exact order:
  --   a) unit_not_found: no such unit, or its Space isn't Verified (N4, D-055)
  if v_unit.id is null then
    raise exception 'unit_not_found'
      using errcode = 'P0001', hint = 'unit_not_found';
  end if;

  select s.id, s.status, s.opens_at, s.closes_at, s.max_wait_window
  into v_space
  from public.spaces s
  where s.id = v_unit.space_id;

  if v_space.id is null or v_space.status != 'verified' then
    raise exception 'unit_not_found'
      using errcode = 'P0001', hint = 'unit_not_found';
  end if;

  --   b) space_closed: the Space is closed now (N4)
  v_now := clock_timestamp();
  if not private.is_open(v_space.opens_at, v_space.closes_at, v_now) then
    raise exception 'space_closed'
      using errcode = 'P0001', hint = 'space_closed';
  end if;

  --   c) wait_window_not_allowed: not a valid wait window, or longer than the Space's maximum (N4)
  if p_wait_window_minutes is null
     or p_wait_window_minutes not in (15, 30, 45, 60, 75, 90, 105, 120)
     or (p_wait_window_minutes * interval '1 minute') > v_space.max_wait_window then
    raise exception 'wait_window_not_allowed'
      using errcode = 'P0001', hint = 'wait_window_not_allowed';
  end if;

  --   d) wait_window_past_closing: payment window and wait window don't both fit before closing time (N4, D-048)
  select s.payment_window, s.fee_amount
  into v_payment_window, v_fee_amount
  from private.reservation_settings s
  limit 1;

  v_wait_interval := p_wait_window_minutes * interval '1 minute';
  v_next_closing := private.next_closing_time(v_space.opens_at, v_space.closes_at, v_now);

  if v_next_closing is not null then
    if v_now + v_payment_window + v_wait_interval > v_next_closing then
      raise exception 'wait_window_past_closing'
        using errcode = 'P0001', hint = 'wait_window_past_closing';
    end if;
  end if;

  --   e) unit_not_available: the unit has a hold, or its Host-set state isn't available (N1)
  if v_unit.host_state != 'available' or exists (
    select 1 from public.reservations r
    where r.unit_id = p_unit_id
      and r.status in ('pending_payment', 'reserved', 'occupied')
  ) then
    raise exception 'unit_not_available'
      using errcode = 'P0001', hint = 'unit_not_available';
  end if;

  --   f) seeker_has_hold: the caller holds another unit (N2)
  if exists (
    select 1 from public.reservations r
    where r.seeker_id = (select auth.uid())
      and r.status in ('pending_payment', 'reserved', 'occupied')
  ) then
    raise exception 'seeker_has_hold'
      using errcode = 'P0001', hint = 'seeker_has_hold';
  end if;

  -- 5. Inserts reservation and pending payment
  v_payment_window_ends_at := v_now + v_payment_window;

  begin
    insert into public.reservations (
      seeker_id,
      space_id,
      unit_id,
      unit_label,
      status,
      wait_window,
      payment_window_ends_at
    ) values (
      (select auth.uid()),
      v_space.id,
      v_unit.id,
      v_unit.label,
      'pending_payment',
      v_wait_interval,
      v_payment_window_ends_at
    )
    returning reservations.id, reservations.status into v_new_reservation_id, v_new_status;

    insert into public.payments (
      reservation_id,
      status,
      fee_amount
    ) values (
      v_new_reservation_id,
      'pending',
      v_fee_amount
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name = 'reservations_one_active_hold_per_unit' then
        raise exception 'unit_not_available'
          using errcode = 'P0001', hint = 'unit_not_available';
      elsif v_constraint_name = 'reservations_one_active_hold_per_seeker' then
        raise exception 'seeker_has_hold'
          using errcode = 'P0001', hint = 'seeker_has_hold';
      else
        if exists (
          select 1 from public.reservations
          where unit_id = v_unit.id and status in ('pending_payment', 'reserved', 'occupied')
        ) then
          raise exception 'unit_not_available'
            using errcode = 'P0001', hint = 'unit_not_available';
        else
          raise exception 'seeker_has_hold'
            using errcode = 'P0001', hint = 'seeker_has_hold';
        end if;
      end if;
  end;

  -- 6. Returns reservation_id, status, checkout_url and created
  return query select v_new_reservation_id, v_new_status, null::text, true;
  return;
end;
$$;

comment on function public.hold_unit(uuid, integer) is
  'Holds an available unit for a Seeker and creates pending payment. STORY-09 (R1, N1-N5, FR-2.1, FR-2.5).';

revoke all on function public.hold_unit(uuid, integer) from public, anon, authenticated;
grant execute on function public.hold_unit(uuid, integer) to authenticated;

-- 3. public.cancel_hold(reservation_id, expected_status)
create or replace function public.cancel_hold(
  p_reservation_id uuid,
  p_expected_status public.reservation_status
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_unit_id uuid;
  v_res_id uuid;
  v_res_seeker_id uuid;
  v_res_status public.reservation_status;
begin
  -- Check caller is authenticated
  if (select auth.uid()) is null then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- 1. Check reservation exists and belongs to caller (N8) before acquiring locks
  select r.unit_id, r.seeker_id into v_unit_id, v_res_seeker_id
  from public.reservations r
  where r.id = p_reservation_id;

  if v_res_seeker_id is null or v_res_seeker_id is distinct from (select auth.uid()) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- Record lapses first for unit (D-047)
  if v_unit_id is not null then
    perform private.record_lapses(array[v_unit_id]);
  end if;

  -- 2. Locks in order: unit (by id), then reservations, then payments (D-047, check-in §2)
  if v_unit_id is not null then
    perform 1 from public.units where id = v_unit_id for update;
  end if;

  select r.id, r.seeker_id, r.status
  into v_res_id, v_res_seeker_id, v_res_status
  from public.reservations r
  where r.id = p_reservation_id
  for update;

  -- N8: Re-verify caller ownership under lock
  if v_res_id is null or v_res_seeker_id is distinct from (select auth.uid()) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- N11: Refuses with P0001 and hold_ended if reservation has ended
  if v_res_status in ('expired', 'no_show', 'completed', 'cancelled') then
    raise exception 'hold_ended'
      using errcode = 'P0001', hint = 'hold_ended';
  end if;

  -- Refuses with P0001 and checked_in if occupied
  if v_res_status = 'occupied' then
    raise exception 'checked_in'
      using errcode = 'P0001', hint = 'checked_in';
  end if;

  -- N21, D-050: Refuses with P0001 and hold_changed if status differs from expected
  if p_expected_status is null or v_res_status is distinct from p_expected_status then
    raise exception 'hold_changed'
      using errcode = 'P0001', hint = 'hold_changed';
  end if;

  -- Lock payment
  perform 1
  from public.payments
  where reservation_id = p_reservation_id
  for update;

  -- R4: pending_payment -> cancelled, payment stays pending
  -- R8: reserved -> cancelled, payment becomes forfeited
  if v_res_status = 'pending_payment' then
    update public.reservations
    set status = 'cancelled',
        ended_at = clock_timestamp()
    where id = p_reservation_id;
  elsif v_res_status = 'reserved' then
    update public.reservations
    set status = 'cancelled',
        ended_at = clock_timestamp()
    where id = p_reservation_id;

    update public.payments
    set status = 'forfeited'
    where reservation_id = p_reservation_id;
  end if;
end;
$$;

comment on function public.cancel_hold(uuid, public.reservation_status) is
  'Cancels a pending_payment or reserved hold for the holding Seeker. STORY-09 (R4, R8, N8, N11, N21).';

revoke all on function public.cancel_hold(uuid, public.reservation_status) from public, anon, authenticated;
grant execute on function public.cancel_hold(uuid, public.reservation_status) to authenticated;
