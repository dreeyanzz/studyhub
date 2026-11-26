-- STORY-20, TSK-20.1: Space verification's follow-ups (D-079, D-084 to D-086). The
-- reason and who moved the status last, the list of changes (space_events), a
-- take-down's hold cancellations (R13, R14), the 4-argument set_space_status,
-- resubmit_space (V8), the triggers for an edited Verified Space (V6), N15 in
-- unit_states and hold_terms, and spaces in the Realtime publication.
-- Design: docs/design/STORY-20-verification-follow-ups.md §2. Flows:
-- docs/flows/space-verification.md, docs/flows/reservation-lifecycle.md. Never edit
-- this file once applied; add a new migration instead.

-- 1. spaces: the reason, and who moved the status last and when (design §2). No role
--    is granted insert or update on any of them, as for status (N2): only the functions
--    and the trigger below write them. The table-wide select grant covers reading them,
--    under STORY-01's select policy (N12).
alter table public.spaces
  add column status_reason text,
  add column status_changed_at timestamptz not null default now(),
  add column status_changed_by uuid references public.profiles (id) on delete set null;

comment on column public.spaces.status is
  'Verification status: pending, verified, rejected or taken_down. Changed only by public.set_space_status, public.resubmit_space and the reverify_on_identity_edit trigger. STORY-15, STORY-20 (FR-5.1, D-053, D-084).';
comment on column public.spaces.status_reason is
  'The Administrator''s reason for the last rejection or take-down, 1 to 500 characters after trimming. Kept on a resubmission, cleared when the Space becomes Verified. STORY-20 (D-084).';
comment on column public.spaces.status_changed_at is
  'When status last changed. Orders the verification queue, oldest first. STORY-20 (D-084).';
comment on column public.spaces.status_changed_by is
  'Who last changed status: an Administrator, or the Host by resubmitting or editing. Null afterwards if that account is deleted. STORY-20 (D-084).';

-- Existing Spaces show their creation date until their next move (design §2). The
-- backfill isn't an edit, so it leaves updated_at, which N9 compares, as it was.
alter table public.spaces disable trigger set_updated_at;
update public.spaces set status_changed_at = created_at;
alter table public.spaces enable trigger set_updated_at;

alter table public.spaces
  add constraint spaces_status_reason_length
    check (
      status_reason is null
      or char_length(regexp_replace(status_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
        between 1 and 500
    ),
  -- N12 at the schema level: a Verified Space never carries an old reason.
  add constraint spaces_verified_has_no_reason
    check (status <> 'verified' or status_reason is null);

-- The Pending queue (oldest waiting first) and the Rejected and Taken down lists.
create index spaces_status_changed_at_idx on public.spaces (status, status_changed_at asc);
-- Deleting a profile sets status_changed_by to null on its Spaces.
create index spaces_status_changed_by_idx on public.spaces (status_changed_by);

-- 2. reservations: a hold a take-down (V7), or rejecting an edited Space (V3), cancelled
--    (R13, R14, D-085), so the Seeker's hold page can say so.
alter table public.reservations
  add column cancelled_by_take_down boolean not null default false,
  add constraint reservations_cancelled_by_take_down_status
    check (not cancelled_by_take_down or status = 'cancelled');

comment on column public.reservations.cancelled_by_take_down is
  'True when an Administrator''s take-down, or rejection of an edited Space, cancelled this hold (R13, R14). STORY-20 (D-085).';

-- 3. space_events: each Space's list of changes (D-086). Administrators read it (N13),
--    and only the functions and the trigger below write it (N14).
create table public.space_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  from_status public.space_status,
  to_status public.space_status,
  reason text,
  old_name text,
  new_name text,
  old_address text,
  new_address text,
  old_latitude double precision,
  new_latitude double precision,
  old_longitude double precision,
  new_longitude double precision,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  -- A status move has both ends, and an identity edit with no move has neither.
  constraint space_events_status_pair
    check ((from_status is null) = (to_status is null)),
  constraint space_events_has_change
    check (
      (from_status is not null and to_status is not null)
      or old_name is distinct from new_name
      or old_address is distinct from new_address
      or old_latitude is distinct from new_latitude
      or old_longitude is distinct from new_longitude
    )
);

comment on table public.space_events is
  'Each Space''s list of changes: every status move but V1 and V5, and every change to its name, address or map pin. Only Administrators read it. STORY-20 (D-086).';

create index space_events_space_created_idx
  on public.space_events (space_id, created_at desc, id desc);
create index space_events_actor_id_idx on public.space_events (actor_id);

alter table public.space_events enable row level security;
revoke all on table public.space_events from anon, authenticated;
grant select on table public.space_events to authenticated;

create policy "space_events: administrators read the list of changes"
  on public.space_events
  for select
  to authenticated
  using ((select private.has_role('admin')));

-- 4. public.set_space_status(space_id, status, updated_at, reason): an Administrator's
--    move (V2, V3, V7, V9, V10). It replaces STORY-15's 3-argument version, so PostgREST
--    sees one function.
drop function public.set_space_status(uuid, public.space_status, timestamptz);

create function public.set_space_status(
  p_space_id uuid,
  p_status public.space_status,
  p_updated_at timestamptz,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_old_status public.space_status;
  v_updated_at timestamptz;
  v_move text;
  v_reason text;
  v_unit_ids uuid[];
  v_cancelled jsonb := '[]'::jsonb;
  v_now timestamptz;
begin
  -- N3: only Administrators.
  if not (select private.has_role('admin')) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;
  v_caller_id := (select auth.uid());

  -- Lock the Space first, so a Host's edit waits, then reads the new status.
  select s.status, s.updated_at
  into v_old_status, v_updated_at
  from public.spaces s
  where s.id = p_space_id
  for update;

  if not found then
    raise exception 'space not found'
      using errcode = 'P0001', hint = 'not_found';
  end if;

  -- N9: only the version the Administrator read.
  if p_updated_at is null or v_updated_at is distinct from p_updated_at then
    raise exception 'the Space changed since it was read'
      using errcode = 'P0001', hint = 'stale_version';
  end if;

  -- N5: only these five moves.
  v_move := case
    when v_old_status = 'pending' and p_status = 'verified' then 'V2'
    when v_old_status = 'pending' and p_status = 'rejected' then 'V3'
    when v_old_status = 'verified' and p_status = 'taken_down' then 'V7'
    when v_old_status = 'rejected' and p_status = 'verified' then 'V9'
    when v_old_status = 'taken_down' and p_status = 'verified' then 'V10'
  end;

  if v_move is null then
    raise exception 'not an allowed status move'
      using errcode = 'P0001', hint = 'invalid_transition';
  end if;

  -- N10: a rejection and a take-down need a reason, trimmed, 1 to 500 characters.
  -- The other moves ignore one and clear the stored reason.
  if v_move in ('V3', 'V7') then
    v_reason := regexp_replace(p_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if v_reason is null or char_length(v_reason) not between 1 and 500 then
      raise exception 'a rejection or take-down needs a reason of 1 to 500 characters'
        using errcode = 'P0001', hint = 'invalid_reason';
    end if;

    -- R13, R14 (D-085). Lock the units in id order, then record their lapses under the
    -- lock (D-047), as confirm_payment does, then lock the holds, then their payments:
    -- the reservation lifecycle's order. A hold that lapsed meanwhile reads expired or
    -- no_show, and isn't cancelled.
    select coalesce(array_agg(u.id order by u.id), '{}')
    into v_unit_ids
    from public.units u
    where u.space_id = p_space_id;

    if array_length(v_unit_ids, 1) > 0 then
      perform 1
      from public.units u
      where u.id = any(v_unit_ids)
      order by u.id
      for update;

      perform private.record_lapses(v_unit_ids);
    end if;

    perform 1
    from public.reservations r
    where r.space_id = p_space_id
      and r.status in ('pending_payment', 'reserved')
    order by r.id
    for update;

    perform 1
    from public.payments p
    join public.reservations r on r.id = p.reservation_id
    where r.space_id = p_space_id
      and r.status in ('pending_payment', 'reserved')
    order by p.id
    for update of p;

    -- What the Server Action needs to close each checkout and refund each paid fee.
    select coalesce(jsonb_agg(h.hold order by h.reservation_id), '[]'::jsonb)
    into v_cancelled
    from (
      select
        r.id as reservation_id,
        jsonb_build_object(
          'reservation_id', r.id,
          'previous_status', r.status,
          'payment_id', p.id,
          'payment_status', p.status,
          'checkout_session_id', p.checkout_session_id,
          'payment_intent_id', p.external_payment_id
        ) as hold
      from public.reservations r
      join public.payments p on p.reservation_id = r.id
      where r.space_id = p_space_id
        and r.status in ('pending_payment', 'reserved')
    ) h;

    v_now := clock_timestamp();

    -- Occupied holds keep running to check-out or closing time (D-085). Payments stay
    -- as they are: a paid fee is refunded through STORY-14's record_refund (P1).
    update public.reservations r
    set status = 'cancelled',
        ended_at = v_now,
        cancelled_by_take_down = true
    where r.space_id = p_space_id
      and r.status in ('pending_payment', 'reserved');
  else
    v_now := clock_timestamp();
  end if;

  -- set_updated_at moves updated_at, which the next decision compares (N9).
  update public.spaces
  set status = p_status,
      status_reason = v_reason,
      status_changed_at = v_now,
      status_changed_by = v_caller_id
  where id = p_space_id
  returning updated_at into v_updated_at;

  insert into public.space_events (space_id, from_status, to_status, reason, actor_id, created_at)
  values (p_space_id, v_old_status, p_status, v_reason, v_caller_id, v_now);

  return jsonb_build_object(
    'space_id', p_space_id,
    'status', p_status,
    'updated_at', v_updated_at,
    'cancelled_holds', v_cancelled
  );
end;
$$;

comment on function public.set_space_status(uuid, public.space_status, timestamptz, text) is
  'An Administrator''s verification move (V2, V3, V7, V9, V10), on the version they read. A rejection or take-down needs a reason and cancels unstarted holds (R13, R14), which it returns. STORY-15, STORY-20 (FR-5.1, D-053, D-084, D-085).';

revoke all on function public.set_space_status(uuid, public.space_status, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.set_space_status(uuid, public.space_status, timestamptz, text)
  to authenticated;

-- 5. public.resubmit_space(space_id): V8, the Host sends a Rejected or Taken down Space
--    back to Pending. It keeps the reason, so the queue shows it beside "Resubmitted".
create function public.resubmit_space(p_space_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_host_id uuid;
  v_old_status public.space_status;
  v_updated_at timestamptz;
  v_now timestamptz;
begin
  -- N4: never signed out.
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  select s.host_id, s.status
  into v_host_id, v_old_status
  from public.spaces s
  where s.id = p_space_id
  for update;

  -- N11: only the Space's own Host (D-095). A missing Space reads the same, so the
  -- answer says nothing about Spaces the caller can't see.
  if not found
    or v_host_id is distinct from v_caller_id
    or not (select private.has_role('host'))
  then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- N11: only a Rejected or Taken down Space.
  if v_old_status not in ('rejected', 'taken_down') then
    raise exception 'only a Rejected or Taken down Space can be resubmitted'
      using errcode = 'P0001', hint = 'not_resubmittable';
  end if;

  v_now := clock_timestamp();

  update public.spaces
  set status = 'pending',
      status_changed_at = v_now,
      status_changed_by = v_caller_id
  where id = p_space_id
  returning updated_at into v_updated_at;

  insert into public.space_events (space_id, from_status, to_status, actor_id, created_at)
  values (p_space_id, v_old_status, 'pending', v_caller_id, v_now);

  return jsonb_build_object(
    'space_id', p_space_id,
    'status', 'pending',
    'updated_at', v_updated_at
  );
end;
$$;

comment on function public.resubmit_space(uuid) is
  'A Host resubmits their own Rejected or Taken down Space: V8, back to Pending, keeping the reason. STORY-20 (FR-5.1, D-084).';

revoke all on function public.resubmit_space(uuid) from public, anon, authenticated;
grant execute on function public.resubmit_space(uuid) to authenticated;

-- 6. V6: a change to a Verified Space's name, address or map pin sends it back to
--    Pending (D-079). "is distinct from" counts adding a pin to a Space with none
--    (D-084), and saving the same values isn't a change. The trigger runs after
--    check_space_hours_before_update and before set_updated_at (alphabetical order).
--    A statement that moves the status itself (set_space_status) is left alone.
create function private.reverify_on_identity_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'verified'
    and new.status = 'verified'
    and (
      new.name is distinct from old.name
      or new.address is distinct from old.address
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
    )
  then
    new.status := 'pending';
    new.status_changed_at := clock_timestamp();
    new.status_changed_by := (select auth.uid());
  end if;

  return new;
end;
$$;

comment on function private.reverify_on_identity_edit() is
  'Sends a Verified Space back to Pending when its name, address or map pin changes (V6). Its holds keep running. STORY-20 (D-079, D-084).';

revoke all on function private.reverify_on_identity_edit() from public, anon, authenticated;

create trigger reverify_on_identity_edit
  before update on public.spaces
  for each row execute function private.reverify_on_identity_edit();

-- Adds each change to a Space's name, address or map pin to its list of changes,
-- whatever its status, and V6's move with it (D-086). Security definer, because no
-- role may write space_events (N14). A pin change records both coordinates.
create function private.record_space_identity_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name_changed boolean := new.name is distinct from old.name;
  v_address_changed boolean := new.address is distinct from old.address;
  v_pin_changed boolean := new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude;
  v_reverified boolean := old.status = 'verified' and new.status = 'pending';
begin
  if not (v_name_changed or v_address_changed or v_pin_changed) then
    return null;
  end if;

  insert into public.space_events (
    space_id,
    from_status,
    to_status,
    old_name,
    new_name,
    old_address,
    new_address,
    old_latitude,
    new_latitude,
    old_longitude,
    new_longitude,
    actor_id,
    created_at
  )
  values (
    new.id,
    case when v_reverified then old.status end,
    case when v_reverified then new.status end,
    case when v_name_changed then old.name end,
    case when v_name_changed then new.name end,
    case when v_address_changed then old.address end,
    case when v_address_changed then new.address end,
    case when v_pin_changed then old.latitude end,
    case when v_pin_changed then new.latitude end,
    case when v_pin_changed then old.longitude end,
    case when v_pin_changed then new.longitude end,
    (select auth.uid()),
    -- V6's entry carries the same time as the move itself.
    case when v_reverified then new.status_changed_at else clock_timestamp() end
  );

  return null;
end;
$$;

comment on function private.record_space_identity_edit() is
  'Adds a change to a Space''s name, address or map pin, and V6''s move with it, to its list of changes. STORY-20 (D-086).';

revoke all on function private.record_space_identity_edit() from public, anon, authenticated;

create trigger record_space_identity_edit
  after update on public.spaces
  for each row execute function private.record_space_identity_edit();

-- 7. public.my_reservation(reservation_id): STORY-10's version, plus
--    cancelled_by_take_down, so the hold page can say a take-down ended it (D-085).
--    A new result column needs drop and create.
drop function public.my_reservation(uuid);

create function public.my_reservation(p_reservation_id uuid default null)
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
  ended_at timestamptz,
  cancelled_by_take_down boolean
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
      r.ended_at,
      r.cancelled_by_take_down
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
      r.ended_at,
      r.cancelled_by_take_down
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
  'Returns the caller''s own reservation or active hold, including checked_in_at and cancelled_by_take_down. STORY-09, STORY-10, STORY-20 (D-047, D-057, D-085).';

revoke all on function public.my_reservation(uuid) from public, anon, authenticated;
grant execute on function public.my_reservation(uuid) to authenticated;

-- 8. N15: unit_states and hold_terms hide every Space that isn't Verified from all but
--    its Host and Administrators (D-084, D-055). Before, they checked for pending or
--    rejected, so taken_down slipped past both. Otherwise STORY-10's and STORY-09's
--    latest versions, unchanged.
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

  -- A Space that isn't Verified is visible only to its Host and Administrators (D-055, N15, N19)
  if v_space_status is distinct from 'verified' then
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

  -- Only the Space's Host sees reservation_id (N25, D-057) and wait_window_ends_at (N20, FR-3.3)
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
  'Canonical read interface for unit seat states, freshness, host wait window and active hold ids. Nothing for a Space that isn''t Verified, except to its Host and Administrators. STORY-09, STORY-10, STORY-20 (D-046, D-047, D-057, D-084).';

revoke all on function public.unit_states(uuid) from public;
grant execute on function public.unit_states(uuid) to anon, authenticated;

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

  -- A Space that isn't Verified is visible only to its Host and Administrators (D-055, N15, N19)
  if v_space_status is distinct from 'verified' then
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
  'Hold terms, allowed wait windows and closing time for a Space. Nothing for a Space that isn''t Verified, except to its Host and Administrators. STORY-09, STORY-20 (D-048, D-055, D-067, D-084).';

revoke all on function public.hold_terms(uuid) from public, anon, authenticated;
grant execute on function public.hold_terms(uuid) to anon, authenticated;

-- 9. The live notice (D-086): spaces joins the supabase_realtime publication, and
--    Realtime applies each listener's select policy. Guarded, so a database without
--    the publication (CI's db job starts Postgres without Realtime) applies cleanly,
--    and a re-run doesn't fail on a table already in it.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'spaces'
    )
  then
    alter publication supabase_realtime add table public.spaces;
  end if;
end;
$$;
