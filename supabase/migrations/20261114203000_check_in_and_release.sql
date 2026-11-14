-- STORY-10, TSK-10.1: Check-in, check-out, complete lapse recording, and closing-time protection.
-- Implements docs/design/STORY-10-check-in-release.md §2, docs/flows/check-in.md, and
-- docs/flows/reservation-lifecycle.md (R5, R6, R7, H2, C1-C7, C-N1-C-N4, N22, D-047, D-048, D-051, D-062).

-- 1. private.last_closing_time(opens_at, closes_at, at) (FR-2.8, D-048)
create or replace function private.last_closing_time(
  p_opens_at time,
  p_closes_at time,
  p_at timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_manila_date date;
  v_closing_today timestamptz;
begin
  if p_opens_at is null or p_closes_at is null or p_at is null then
    return null;
  end if;

  if p_opens_at = p_closes_at then
    return null;
  end if;

  v_manila_date := (p_at at time zone 'Asia/Manila')::date;
  v_closing_today := (v_manila_date + p_closes_at) at time zone 'Asia/Manila';

  if p_at >= v_closing_today then
    return v_closing_today;
  else
    return ((v_manila_date - 1) + p_closes_at) at time zone 'Asia/Manila';
  end if;
end;
$$;

comment on function private.last_closing_time(time, time, timestamptz) is
  'Most recent closing timestamp in Asia/Manila at or before p_at, or null for 24-hour spaces. STORY-10 (FR-2.8, D-048).';

revoke all on function private.last_closing_time(time, time, timestamptz) from public, anon, authenticated;

-- 2. Complete private.record_lapses (steps 1-4: R3, R7, R6, H2; D-047, D-048, D-051)
create or replace function private.record_lapses(p_unit_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_lapsed_unit_ids uuid[];
begin
  if p_unit_ids is null or array_length(p_unit_ids, 1) is null then
    return;
  end if;

  v_now := clock_timestamp();

  -- 1. Unlocked probe across all four lapse steps (D-047)
  select coalesce(array_agg(u.id order by u.id), '{}')
  into v_lapsed_unit_ids
  from public.units u
  join public.spaces s on s.id = u.space_id
  where u.id = any(p_unit_ids)
    and (
      exists (
        select 1
        from public.reservations r
        where r.unit_id = u.id
          and (
            (r.status = 'pending_payment' and r.payment_window_ends_at <= v_now)
            or (r.status = 'reserved' and r.wait_window_ends_at <= v_now)
            or (
              r.status = 'occupied'
              and private.last_closing_time(s.opens_at, s.closes_at, v_now) is not null
              and r.checked_in_at < private.last_closing_time(s.opens_at, s.closes_at, v_now)
            )
          )
      )
      or (
        u.host_state in ('reserved', 'occupied')
        and private.last_closing_time(s.opens_at, s.closes_at, v_now) is not null
        and u.host_updated_at < private.last_closing_time(s.opens_at, s.closes_at, v_now)
      )
    );

  if coalesce(array_length(v_lapsed_unit_ids, 1), 0) = 0 then
    return;
  end if;

  -- 2. Lock units in id order (D-047)
  perform 1
  from public.units u
  where u.id = any(v_lapsed_unit_ids)
  order by u.id
  for update;

  v_now := clock_timestamp();

  -- Step 1 (R3): pending_payment -> expired (payment stays pending, D-046)
  update public.reservations r
  set status = 'expired',
      ended_at = v_now
  where r.unit_id = any(v_lapsed_unit_ids)
    and r.status = 'pending_payment'
    and r.payment_window_ends_at <= v_now;

  -- Step 2 (R7): reserved -> no_show, payment paid -> forfeited
  with lapsed_no_show as (
    update public.reservations r
    set status = 'no_show',
        ended_at = v_now
    where r.unit_id = any(v_lapsed_unit_ids)
      and r.status = 'reserved'
      and r.wait_window_ends_at <= v_now
    returning r.id
  )
  update public.payments p
  set status = 'forfeited'
  from lapsed_no_show l
  where p.reservation_id = l.id
    and p.status = 'paid';

  -- Step 3 (R6): occupied -> completed at closing time (checked_out_at stays null, D-048)
  update public.reservations r
  set status = 'completed',
      ended_at = v_now
  from public.spaces s
  where s.id = r.space_id
    and r.unit_id = any(v_lapsed_unit_ids)
    and r.status = 'occupied'
    and private.last_closing_time(s.opens_at, s.closes_at, v_now) is not null
    and r.checked_in_at < private.last_closing_time(s.opens_at, s.closes_at, v_now);

  -- Step 4 (H2): host override reset to available at closing time (host_updated_at untouched, D-051)
  update public.units u
  set host_state = 'available'
  from public.spaces s
  where s.id = u.space_id
    and u.id = any(v_lapsed_unit_ids)
    and u.host_state in ('reserved', 'occupied')
    and private.last_closing_time(s.opens_at, s.closes_at, v_now) is not null
    and u.host_updated_at < private.last_closing_time(s.opens_at, s.closes_at, v_now);
end;
$$;

comment on function private.record_lapses(uuid[]) is
  'Records lapses for units across all 4 steps: expired unpaid holds (R3), no-shows (R7), closing-time completed visits (R6), and closing-time host override resets (H2). STORY-09/STORY-10 (D-047, D-048, D-051).';

revoke all on function private.record_lapses(uuid[]) from public, anon, authenticated;

-- 3. public.check_in(token, space_id) (FR-2.7, C1-C7, C-N1-C-N4, D-062)
create or replace function public.check_in(
  p_token text,
  p_space_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_probe_id uuid;
  v_probe_space_id uuid;
  v_probe_unit_id uuid;
  v_unit_id uuid;
  v_unit_label text;
  v_zone_name text;
  v_res public.reservations%rowtype;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null or p_space_id is null or not exists (
    select 1
    from public.spaces s
    where s.id = p_space_id
      and s.host_id = v_caller_id
  ) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  if p_token is null then
    raise exception 'invalid booking token'
      using errcode = 'P0001', hint = 'invalid_token';
  end if;

  -- 1. Unlocked probe by booking token (C-N1, C-N2)
  select r.id, r.space_id, r.unit_id
  into v_probe_id, v_probe_space_id, v_probe_unit_id
  from public.reservations r
  where r.booking_token = p_token;

  if not found then
    raise exception 'invalid booking token'
      using errcode = 'P0001', hint = 'invalid_token';
  end if;

  if v_probe_space_id is distinct from p_space_id then
    raise exception 'booking token belongs to another space'
      using errcode = 'P0001', hint = 'wrong_space';
  end if;

  -- 2. Lock unit (if present) then reservation (D-047, D-062)
  if v_probe_unit_id is not null then
    select u.id, u.label, z.name
    into v_unit_id, v_unit_label, v_zone_name
    from public.units u
    join public.zones z on z.id = u.zone_id
    where u.id = v_probe_unit_id
    for update of u;
  end if;

  select r.*
  into v_res
  from public.reservations r
  where r.id = v_probe_id
  for update;

  -- 3. Record lapses under lock so expired wait windows commit as no_show (C4, R7)
  if v_unit_id is not null then
    perform private.record_lapses(array[v_unit_id]);

    select r.*
    into v_res
    from public.reservations r
    where r.id = v_probe_id;
  end if;

  -- 4. Branch on status under lock (C3-C7)
  if v_res.status = 'no_show' then
    return jsonb_build_object(
      'outcome', 'wait_window_lapsed',
      'unit_id', v_res.unit_id,
      'unit_label', coalesce(v_unit_label, v_res.unit_label)
    );
  end if;

  if v_res.status = 'cancelled' then
    raise exception 'reservation was cancelled'
      using errcode = 'P0001', hint = 'reservation_cancelled';
  end if;

  if v_res.status in ('occupied', 'completed') then
    raise exception 'booking token was already used'
      using errcode = 'P0001', hint = 'token_already_used';
  end if;

  if v_res.status <> 'reserved' then
    raise exception 'reservation is not ready for check-in'
      using errcode = 'P0001', hint = 'invalid_state';
  end if;

  -- 5. Check in: reserved -> occupied (R2, C3)
  update public.reservations
  set status = 'occupied',
      checked_in_at = clock_timestamp()
  where id = v_res.id;

  return jsonb_build_object(
    'outcome', 'success',
    'unit_id', v_unit_id,
    'unit_label', coalesce(v_unit_label, v_res.unit_label),
    'zone_name', v_zone_name
  );
end;
$$;

comment on function public.check_in(text, uuid) is
  'Checks a reserved Seeker into their held unit by booking token for the Host''s Space. STORY-10 (FR-2.7, D-060, D-062).';

revoke all on function public.check_in(text, uuid) from public, anon, authenticated;
grant execute on function public.check_in(text, uuid) to authenticated;

-- 4. public.check_out(reservation_id) (FR-2.8, R5, N8, N11)
create or replace function public.check_out(p_reservation_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_probe_id uuid;
  v_probe_unit_id uuid;
  v_probe_seeker_id uuid;
  v_res public.reservations%rowtype;
  v_now timestamptz;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null or p_reservation_id is null then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- 1. Unlocked ownership check (N8)
  select r.id, r.unit_id, r.seeker_id
  into v_probe_id, v_probe_unit_id, v_probe_seeker_id
  from public.reservations r
  where r.id = p_reservation_id;

  if not found or v_probe_seeker_id is distinct from v_caller_id then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- 2. Lock unit (if present) then reservation (D-047)
  if v_probe_unit_id is not null then
    perform 1
    from public.units u
    where u.id = v_probe_unit_id
    for update;
  end if;

  select r.*
  into v_res
  from public.reservations r
  where r.id = p_reservation_id
  for update;

  if not found or v_res.seeker_id is distinct from v_caller_id then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- 3. Record lapses under lock so closing-time completed visits are caught before check-out (D-047, R6)
  if v_res.unit_id is not null then
    perform private.record_lapses(array[v_res.unit_id]);

    select r.*
    into v_res
    from public.reservations r
    where r.id = p_reservation_id;
  end if;

  -- 4. Validate state under lock (N11)
  if v_res.status in ('expired', 'no_show', 'completed', 'cancelled') then
    raise exception 'hold has already ended'
      using errcode = 'P0001', hint = 'hold_ended';
  end if;

  if v_res.status in ('pending_payment', 'reserved') then
    raise exception 'reservation is not checked in'
      using errcode = 'P0001', hint = 'not_checked_in';
  end if;

  -- 5. Release unit: occupied -> completed (R5)
  v_now := clock_timestamp();

  update public.reservations
  set status = 'completed',
      checked_out_at = v_now,
      ended_at = v_now
  where id = v_res.id;

  return jsonb_build_object(
    'outcome', 'success',
    'reservation_id', v_res.id,
    'unit_id', v_res.unit_id
  );
end;
$$;

comment on function public.check_out(uuid) is
  'Checks out a checked-in Seeker from their occupied unit, releasing it immediately. STORY-10 (FR-2.8, R5, N8, N11).';

revoke all on function public.check_out(uuid) from public, anon, authenticated;
grant execute on function public.check_out(uuid) to authenticated;

-- 5. Update public.unit_states(space_id) to populate wait_window_ends_at for the Space's Host
create or replace function public.unit_states(p_space_id uuid)
returns table (
  unit_id uuid,
  seat_state text,
  host_updated_at timestamptz,
  wait_window_ends_at timestamptz,
  reservation_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_space_status public.space_status;
  v_host_id uuid;
  v_unit_ids uuid[];
  v_is_host boolean;
begin
  select status, host_id into v_space_status, v_host_id
  from public.spaces
  where id = p_space_id;

  if not found then
    return;
  end if;

  -- Pending or Rejected Spaces are visible only to their Host and Administrators (D-055, N19)
  if v_space_status in ('pending', 'rejected') then
    if (select auth.uid()) is distinct from v_host_id and not (select private.has_role('admin')) then
      return;
    end if;
  end if;

  -- Collect unit IDs for lapse recording (D-047)
  select coalesce(array_agg(u.id order by u.id), '{}')
  into v_unit_ids
  from public.units u
  where u.space_id = p_space_id;

  if array_length(v_unit_ids, 1) > 0 then
    perform private.record_lapses(v_unit_ids);
  end if;

  -- Only the Space's Host sees reservation_id and wait_window_ends_at (N25, D-057)
  v_is_host := ((select auth.uid()) is not distinct from v_host_id);

  return query
  select
    u.id as unit_id,
    coalesce(r.status::text, u.host_state) as seat_state,
    u.host_updated_at,
    case when v_is_host and r.status = 'reserved' then r.wait_window_ends_at else null end as wait_window_ends_at,
    case when v_is_host then r.id else null end as reservation_id
  from public.units u
  left join public.reservations r
    on r.unit_id = u.id
   and r.status in ('pending_payment', 'reserved', 'occupied')
  where u.space_id = p_space_id
  order by u.zone_id, u.grid_row, u.grid_col;
end;
$$;

comment on function public.unit_states(uuid) is
  'Canonical read interface for unit seat states, freshness, host wait window and active hold ids. STORY-09/STORY-10 (D-046, D-047, D-057).';

revoke all on function public.unit_states(uuid) from public;
grant execute on function public.unit_states(uuid) to anon, authenticated;

-- 6. Recreate public.my_reservation(reservation_id) adding checked_in_at
drop function public.my_reservation(uuid);

create or replace function public.my_reservation(p_reservation_id uuid default null)
returns table (
  id uuid,
  status public.reservation_status,
  payment_status public.payment_status,
  fee_amount integer,
  space_id uuid,
  space_name text,
  space_address text,
  unit_id uuid,
  unit_label text,
  zone_name text,
  wait_window_minutes integer,
  payment_window_ends_at timestamptz,
  wait_window_ends_at timestamptz,
  booking_token text,
  checkout_session_id text,
  checkout_url text,
  created_at timestamptz,
  checked_in_at timestamptz,
  ended_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_unit_id uuid;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    return;
  end if;

  if p_reservation_id is not null then
    select r.unit_id into v_unit_id
    from public.reservations r
    where r.id = p_reservation_id
      and r.seeker_id = v_caller_id;

    if v_unit_id is not null then
      perform private.record_lapses(array[v_unit_id]);
    end if;

    return query
    select
      r.id,
      r.status,
      p.status as payment_status,
      p.fee_amount,
      r.space_id,
      s.name as space_name,
      s.address as space_address,
      r.unit_id,
      r.unit_label,
      z.name as zone_name,
      round(extract(epoch from r.wait_window) / 60)::integer as wait_window_minutes,
      r.payment_window_ends_at,
      r.wait_window_ends_at,
      case when r.status = 'reserved' then r.booking_token else null end as booking_token,
      case when r.status = 'pending_payment' and p.status = 'pending' then p.checkout_session_id else null end as checkout_session_id,
      case when r.status = 'pending_payment' and p.status = 'pending' then p.checkout_url else null end as checkout_url,
      r.created_at,
      r.checked_in_at,
      r.ended_at
    from public.reservations r
    join public.payments p on p.reservation_id = r.id
    join public.spaces s on s.id = r.space_id
    left join public.units u on u.id = r.unit_id
    left join public.zones z on z.id = u.zone_id
    where r.id = p_reservation_id
      and r.seeker_id = v_caller_id;
  else
    select r.unit_id into v_unit_id
    from public.reservations r
    where r.seeker_id = v_caller_id
      and r.status in ('pending_payment', 'reserved', 'occupied');

    if v_unit_id is not null then
      perform private.record_lapses(array[v_unit_id]);
    end if;

    return query
    select
      r.id,
      r.status,
      p.status as payment_status,
      p.fee_amount,
      r.space_id,
      s.name as space_name,
      s.address as space_address,
      r.unit_id,
      r.unit_label,
      z.name as zone_name,
      round(extract(epoch from r.wait_window) / 60)::integer as wait_window_minutes,
      r.payment_window_ends_at,
      r.wait_window_ends_at,
      case when r.status = 'reserved' then r.booking_token else null end as booking_token,
      case when r.status = 'pending_payment' and p.status = 'pending' then p.checkout_session_id else null end as checkout_session_id,
      case when r.status = 'pending_payment' and p.status = 'pending' then p.checkout_url else null end as checkout_url,
      r.created_at,
      r.checked_in_at,
      r.ended_at
    from public.reservations r
    join public.payments p on p.reservation_id = r.id
    join public.spaces s on s.id = r.space_id
    left join public.units u on u.id = r.unit_id
    left join public.zones z on z.id = u.zone_id
    where r.seeker_id = v_caller_id
      and r.status in ('pending_payment', 'reserved', 'occupied');
  end if;
end;
$$;

comment on function public.my_reservation(uuid) is
  'Returns the caller''s own reservation or active hold including checked_in_at. STORY-09/STORY-10 (D-047, D-057).';

revoke all on function public.my_reservation(uuid) from public, anon, authenticated;
grant execute on function public.my_reservation(uuid) to authenticated;

-- 7. Extend private.check_space_hours_on_update() to protect occupied visits (N22, D-048)
create or replace function private.check_space_hours_on_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit_ids uuid[];
  v_now timestamptz;
  v_next_close timestamptz;
  v_old_next_close timestamptz;
  v_new_last_close timestamptz;
begin
  if NEW.opens_at is not distinct from OLD.opens_at and NEW.closes_at is not distinct from OLD.closes_at then
    return NEW;
  end if;

  select coalesce(array_agg(u.id order by u.id), '{}')
  into v_unit_ids
  from public.units u
  where u.space_id = OLD.id;

  if array_length(v_unit_ids, 1) > 0 then
    perform 1
    from public.units u
    where u.id = any(v_unit_ids)
    order by u.id
    for update;

    perform private.record_lapses(v_unit_ids);
  end if;

  v_now := clock_timestamp();
  v_next_close := private.next_closing_time(NEW.opens_at, NEW.closes_at, v_now);
  v_old_next_close := private.next_closing_time(OLD.opens_at, OLD.closes_at, v_now);
  v_new_last_close := private.last_closing_time(NEW.opens_at, NEW.closes_at, v_now);

  if exists (
    select 1
    from public.reservations r
    where r.space_id = OLD.id
      and r.status in ('pending_payment', 'reserved', 'occupied')
      and (
        not private.is_open(NEW.opens_at, NEW.closes_at, v_now)
        or (
          r.status in ('pending_payment', 'reserved')
          and v_next_close is not null
          and v_next_close < case
            when r.status = 'pending_payment' then r.payment_window_ends_at + r.wait_window
            when r.status = 'reserved' then r.wait_window_ends_at
          end
        )
        or (
          r.status = 'occupied'
          and (
            (v_new_last_close is not null and v_new_last_close > r.checked_in_at)
            or (v_next_close is not null and (v_old_next_close is null or v_next_close < v_old_next_close))
          )
        )
      )
  ) then
    raise exception 'new hours cut into active hold'
      using errcode = 'P0001', hint = 'hours_cut_hold';
  end if;

  return NEW;
end;
$$;
