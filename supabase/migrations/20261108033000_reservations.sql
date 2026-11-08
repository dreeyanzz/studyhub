-- STORY-09, TSK-09.1: reservations and payments tables, settings, max_wait_window,
-- lapse step 1, holds in unit_states, my_reservation, and N17, N22, N23 refusal triggers.
-- Design: docs/design/STORY-09-reserve-now-holds.md. Never edit this file once applied;
-- add a new migration instead.

-- 1. Enums (D-046, SRS §3.8)
create type public.reservation_status as enum (
  'pending_payment',
  'reserved',
  'occupied',
  'expired',
  'no_show',
  'completed',
  'cancelled'
);

create type public.payment_status as enum (
  'pending',
  'paid',
  'forfeited',
  'refunded'
);

-- 2. Wait window validator: immutable, 15 to 120 minutes in 15-minute steps (D-067)
create or replace function private.is_valid_wait_window(p_window interval)
returns boolean
language sql
immutable
parallel safe
as $$
  select p_window is not null
    and extract(epoch from p_window) in (
      900,   -- 15 min
      1800,  -- 30 min
      2700,  -- 45 min
      3600,  -- 60 min
      4500,  -- 75 min
      5400,  -- 90 min
      6300,  -- 105 min
      7200   -- 120 min
    );
$$;

comment on function private.is_valid_wait_window(interval) is
  'Checks if interval is between 15 and 120 minutes in 15-minute steps. STORY-09 (D-067).';

revoke all on function private.is_valid_wait_window(interval) from public;
grant execute on function private.is_valid_wait_window(interval) to anon, authenticated;

-- 3. System hold terms: private.reservation_settings (D-049, D-067)
create table private.reservation_settings (
  id boolean primary key default true check (id),
  payment_window interval not null check (payment_window between '1 minute'::interval and '1 hour'::interval),
  fee_amount integer not null check (fee_amount > 0)
);

comment on table private.reservation_settings is
  'Platform-wide hold parameters: payment window and reservation fee. STORY-09 (D-049, D-067).';

insert into private.reservation_settings (id, payment_window, fee_amount)
values (true, interval '10 minutes', 5000);

alter table private.reservation_settings enable row level security;
revoke all on table private.reservation_settings from anon, authenticated;

-- 4. public.reservations table
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references public.profiles (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  unit_id uuid references public.units (id) on delete set null,
  unit_label text not null,
  status public.reservation_status not null default 'pending_payment',
  wait_window interval not null check (private.is_valid_wait_window(wait_window)),
  payment_window_ends_at timestamptz not null,
  wait_window_ends_at timestamptz,
  booking_token text unique check (booking_token ~ '^[0-9A-HJKMNP-TV-Z]{12}$'),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_hold_has_unit
    check (status not in ('pending_payment', 'reserved', 'occupied') or unit_id is not null),
  constraint reservations_status_tokens_and_windows
    check (
      (status = 'pending_payment' and booking_token is null and wait_window_ends_at is null)
      or (status in ('reserved', 'occupied') and booking_token is not null and wait_window_ends_at is not null)
      or (status in ('expired', 'no_show', 'completed', 'cancelled'))
    ),
  constraint reservations_ended_at_matches_status
    check (
      (status in ('pending_payment', 'reserved', 'occupied') and ended_at is null)
      or (status in ('expired', 'no_show', 'completed', 'cancelled') and ended_at is not null)
    )
);

comment on table public.reservations is
  'Seeker holds, visits and reservation history. STORY-09 (FR-2.1, D-008, D-046).';

-- Unique active hold per unit (N3, FR-2.5)
create unique index reservations_one_active_hold_per_unit
  on public.reservations (unit_id)
  where status in ('pending_payment', 'reserved', 'occupied');

-- Unique active hold per seeker (N2, D-008)
create unique index reservations_one_active_hold_per_seeker
  on public.reservations (seeker_id)
  where status in ('pending_payment', 'reserved', 'occupied');

create index reservations_space_id_idx on public.reservations (space_id);
create index reservations_seeker_id_idx on public.reservations (seeker_id);
create index reservations_unit_id_idx on public.reservations (unit_id);

create trigger set_updated_at
  before update on public.reservations
  for each row execute function private.set_updated_at();

alter table public.reservations enable row level security;
revoke all on table public.reservations from anon, authenticated;

-- 5. public.payments table
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations (id) on delete cascade,
  status public.payment_status not null default 'pending',
  fee_amount integer not null check (fee_amount > 0),
  checkout_session_id text unique,
  checkout_url text,
  external_payment_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_status_fields
    check (
      (status = 'pending' and external_payment_id is null and paid_at is null)
      or (status in ('paid', 'forfeited', 'refunded') and external_payment_id is not null and paid_at is not null)
    )
);

comment on table public.payments is
  'Sandbox reservation fee payment records. STORY-09 (FR-2.3, SRS §3.8, D-049).';

create trigger set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

alter table public.payments enable row level security;
revoke all on table public.payments from anon, authenticated;

-- 6. Add max_wait_window to spaces
alter table public.spaces
  add column max_wait_window interval not null default interval '60 minutes'
  check (private.is_valid_wait_window(max_wait_window));

comment on column public.spaces.max_wait_window is
  'Host-configured maximum wait window for holds. STORY-09 (D-049, D-067).';

grant insert (max_wait_window) on table public.spaces to authenticated;
grant update (max_wait_window) on table public.spaces to authenticated;

-- 7. Time and token helper functions
create or replace function private.is_open(
  p_opens_at time,
  p_closes_at time,
  p_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_time time;
begin
  if p_opens_at is null or p_closes_at is null or p_at is null then
    return false;
  end if;

  if p_opens_at = p_closes_at then
    return true;
  end if;

  v_time := (p_at at time zone 'Asia/Manila')::time;

  if p_opens_at < p_closes_at then
    return v_time >= p_opens_at and v_time < p_closes_at;
  else
    return v_time >= p_opens_at or v_time < p_closes_at;
  end if;
end;
$$;

comment on function private.is_open(time, time, timestamptz) is
  'Whether a Space with given hours is open at the given timestamp in Asia/Manila. STORY-09 (D-048).';

revoke all on function private.is_open(time, time, timestamptz) from public, anon, authenticated;

create or replace function private.next_closing_time(
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

  if p_at < v_closing_today then
    return v_closing_today;
  else
    return ((v_manila_date + 1) + p_closes_at) at time zone 'Asia/Manila';
  end if;
end;
$$;

comment on function private.next_closing_time(time, time, timestamptz) is
  'Next closing timestamp in Asia/Manila after p_at, or null for 24-hour spaces. STORY-09 (D-048).';

revoke all on function private.next_closing_time(time, time, timestamptz) from public, anon, authenticated;

create or replace function private.new_booking_token()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea;
  v_bits bit(64);
  v_token text;
  v_val int;
  v_exists boolean;
begin
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_bits := ('x' || encode(v_bytes, 'hex'))::bit(64);
    v_token := '';
    for i in 0..11 loop
      v_val := substring(v_bits from (i * 5 + 1) for 5)::bit(5)::int;
      v_token := v_token || substr(v_alphabet, v_val + 1, 1);
    end loop;

    select exists (
      select 1 from public.reservations where booking_token = v_token
    ) into v_exists;

    if not v_exists then
      return v_token;
    end if;
  end loop;
end;
$$;

comment on function private.new_booking_token() is
  'Generates a unique 12-character Crockford base32 booking token with 60 bits entropy. STORY-09 (D-059).';

revoke all on function private.new_booking_token() from public, anon, authenticated;

-- 8. Lapse step 1: private.record_lapses (R3, D-047)
create or replace function private.record_lapses(p_unit_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_lapsed_unit_ids uuid[];
begin
  if p_unit_ids is null or array_length(p_unit_ids, 1) is null then
    return;
  end if;

  -- 1. Check without taking a lock (D-047)
  select coalesce(array_agg(distinct r.unit_id order by r.unit_id), '{}')
  into v_lapsed_unit_ids
  from public.reservations r
  where r.unit_id = any(p_unit_ids)
    and r.status = 'pending_payment'
    and r.payment_window_ends_at <= clock_timestamp();

  if array_length(v_lapsed_unit_ids, 1) is null or array_length(v_lapsed_unit_ids, 1) = 0 then
    return;
  end if;

  -- 2. Lock units in id order (D-047)
  perform 1
  from public.units u
  where u.id = any(v_lapsed_unit_ids)
  order by u.id
  for update;

  -- 3. Update expired holds (R3). Payment stays pending (SRS §3.8, D-046).
  update public.reservations r
  set status = 'expired',
      ended_at = clock_timestamp()
  where r.unit_id = any(v_lapsed_unit_ids)
    and r.status = 'pending_payment'
    and r.payment_window_ends_at <= clock_timestamp();
end;
$$;

comment on function private.record_lapses(uuid[]) is
  'Records lapses for units: step 1 moves expired pending_payment holds to expired. STORY-09 (D-047).';

revoke all on function private.record_lapses(uuid[]) from public, anon, authenticated;

-- 9. Update public.unit_states(space_id) to volatile, recording lapses and returning holds
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

  -- Only the Space's Host sees reservation_id (N25, D-057)
  v_is_host := ((select auth.uid()) is not distinct from v_host_id);

  return query
  select
    u.id as unit_id,
    coalesce(r.status::text, u.host_state) as seat_state,
    u.host_updated_at,
    null::timestamptz as wait_window_ends_at,
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
  'Canonical read interface for unit seat states, freshness and active hold ids. STORY-09 (D-046, D-047, D-057).';

revoke all on function public.unit_states(uuid) from public;
grant execute on function public.unit_states(uuid) to anon, authenticated;

-- 10. public.my_reservation(reservation_id)
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
  'Returns the caller''s own reservation or active hold. STORY-09 (D-047, D-057).';

revoke all on function public.my_reservation(uuid) from public, anon, authenticated;
grant execute on function public.my_reservation(uuid) to authenticated;

-- 11. Refusal triggers: N17 (delete unit/zone/space), N23 (update unit layout/label), N22 (update space hours)
create or replace function private.check_unit_held_on_unit_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.record_lapses(array[OLD.id]);

  if exists (
    select 1
    from public.reservations
    where unit_id = OLD.id
      and status in ('pending_payment', 'reserved', 'occupied')
  ) then
    raise exception 'unit has an active hold'
      using errcode = 'P0001', hint = 'unit_held';
  end if;

  return OLD;
end;
$$;

create trigger check_unit_held_before_delete
  before delete on public.units
  for each row execute function private.check_unit_held_on_unit_delete();

create or replace function private.check_unit_held_on_zone_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit_ids uuid[];
begin
  select coalesce(array_agg(u.id order by u.id), '{}')
  into v_unit_ids
  from public.units u
  where u.zone_id = OLD.id;

  if array_length(v_unit_ids, 1) > 0 then
    perform 1
    from public.units u
    where u.id = any(v_unit_ids)
    order by u.id
    for update;

    perform private.record_lapses(v_unit_ids);

    if exists (
      select 1
      from public.reservations
      where unit_id = any(v_unit_ids)
        and status in ('pending_payment', 'reserved', 'occupied')
    ) then
      raise exception 'zone contains a unit with an active hold'
        using errcode = 'P0001', hint = 'unit_held';
    end if;
  end if;

  return OLD;
end;
$$;

create trigger check_unit_held_before_delete
  before delete on public.zones
  for each row execute function private.check_unit_held_on_zone_delete();

create or replace function private.check_unit_held_on_space_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit_ids uuid[];
begin
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

    if exists (
      select 1
      from public.reservations
      where unit_id = any(v_unit_ids)
        and status in ('pending_payment', 'reserved', 'occupied')
    ) then
      raise exception 'space contains a unit with an active hold'
        using errcode = 'P0001', hint = 'unit_held';
    end if;
  end if;

  return OLD;
end;
$$;

create trigger check_unit_held_before_delete
  before delete on public.spaces
  for each row execute function private.check_unit_held_on_space_delete();

create or replace function private.check_unit_held_on_unit_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    NEW.zone_id is distinct from OLD.zone_id or
    NEW.unit_type is distinct from OLD.unit_type or
    NEW.label is distinct from OLD.label or
    NEW.capacity is distinct from OLD.capacity or
    NEW.grid_row is distinct from OLD.grid_row or
    NEW.grid_col is distinct from OLD.grid_col or
    NEW.col_span is distinct from OLD.col_span
  ) then
    perform private.record_lapses(array[OLD.id]);

    if exists (
      select 1
      from public.reservations
      where unit_id = OLD.id
        and status in ('pending_payment', 'reserved', 'occupied')
    ) then
      raise exception 'cannot modify held unit'
        using errcode = 'P0001', hint = 'unit_held';
    end if;
  end if;

  return NEW;
end;
$$;

create trigger check_unit_held_before_update
  before update on public.units
  for each row execute function private.check_unit_held_on_unit_update();

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

  if exists (
    select 1
    from public.reservations r
    where r.space_id = OLD.id
      and r.status in ('pending_payment', 'reserved', 'occupied')
      and (
        not private.is_open(NEW.opens_at, NEW.closes_at, v_now)
        or (
          v_next_close is not null
          and v_next_close < case
            when r.status = 'pending_payment' then r.payment_window_ends_at + r.wait_window
            when r.status in ('reserved', 'occupied') then coalesce(r.wait_window_ends_at, r.payment_window_ends_at + r.wait_window)
          end
        )
      )
  ) then
    raise exception 'new hours cut into active hold'
      using errcode = 'P0001', hint = 'hours_cut_hold';
  end if;

  return NEW;
end;
$$;

create trigger check_space_hours_before_update
  before update of opens_at, closes_at on public.spaces
  for each row execute function private.check_space_hours_on_update();

comment on function private.check_unit_held_on_unit_delete() is
  'Refuses deleting a held unit (N17, D-052). STORY-09.';
comment on function private.check_unit_held_on_zone_delete() is
  'Refuses deleting a zone with a held unit (N17, D-052). STORY-09.';
comment on function private.check_unit_held_on_space_delete() is
  'Refuses deleting a Space with a held unit (N17, D-052). STORY-09.';
comment on function private.check_unit_held_on_unit_update() is
  'Refuses changing a held unit layout, label, type or capacity (N23, D-052). STORY-09.';
comment on function private.check_space_hours_on_update() is
  'Refuses changing Space hours to cut into active holds (N22, D-048). STORY-09.';

revoke all on function private.check_unit_held_on_unit_delete() from public, anon, authenticated;
revoke all on function private.check_unit_held_on_zone_delete() from public, anon, authenticated;
revoke all on function private.check_unit_held_on_space_delete() from public, anon, authenticated;
revoke all on function private.check_unit_held_on_unit_update() from public, anon, authenticated;
revoke all on function private.check_space_hours_on_update() from public, anon, authenticated;
