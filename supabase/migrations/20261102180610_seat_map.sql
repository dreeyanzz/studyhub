-- STORY-07, TSK-07.1: zones, units, exclusion constraints, grants, RLS, and public.unit_states.
-- Design: docs/design/STORY-07-seat-map-builder.md. Never edit this file once applied;
-- add a new migration instead.

create type public.unit_type as enum ('seat', 'standing_desk', 'room');

create extension if not exists btree_gist schema extensions;

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) >= 1 and char_length(name) <= 60),
  position smallint not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zones_id_space_id_key unique (id, space_id)
);

comment on table public.zones is
  'Bands grouping units within a Space''s seat map. STORY-07.';

create unique index zones_space_id_lower_name_idx on public.zones (space_id, lower(name));
create index zones_space_id_idx on public.zones (space_id);

create trigger set_updated_at
  before update on public.zones
  for each row execute function private.set_updated_at();

create table public.units (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  zone_id uuid not null,
  unit_type public.unit_type not null,
  label text not null
    check (char_length(btrim(label)) >= 1 and char_length(label) <= 12),
  capacity smallint,
  grid_row smallint not null check (grid_row >= 0 and grid_row < 50),
  grid_col smallint not null check (grid_col >= 0 and grid_col <= 5),
  col_span smallint not null default 1,
  host_state text not null default 'available'
    check (host_state in ('available', 'reserved', 'occupied')),
  host_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_zone_space_fkey
    foreign key (zone_id, space_id) references public.zones (id, space_id) on delete cascade,
  constraint capacity_matches_type
    check ((unit_type = 'room' and capacity is not null and capacity between 1 and 50)
      or (unit_type in ('seat', 'standing_desk') and capacity is null)),
  constraint col_span_matches_type
    check ((unit_type in ('seat', 'standing_desk') and col_span = 1)
      or (unit_type = 'room' and col_span in (2, 3))),
  constraint col_bounds
    check (grid_col + col_span <= 6)
);

comment on table public.units is
  'Individual reservable units within a Space''s seat map. STORY-07.';
comment on column public.units.host_state is
  'Host-set occupancy state. Direct access is revoked; read via public.unit_states().';
comment on column public.units.host_updated_at is
  'When the host last updated the state. Direct access is revoked; read via public.unit_states().';

alter table public.units add constraint units_no_cell_overlap
  exclude using gist (
    zone_id with =,
    grid_row with =,
    int4range(grid_col, grid_col + col_span) with &&
  );

create unique index units_space_id_lower_label_idx on public.units (space_id, lower(label));
create index units_space_id_idx on public.units (space_id);
create index units_zone_id_idx on public.units (zone_id);

create trigger set_updated_at
  before update on public.units
  for each row execute function private.set_updated_at();

-- Canonical read interface for unit seat states and freshness (D-044, D-046, D-047).
create or replace function public.unit_states(p_space_id uuid)
returns table (
  unit_id uuid,
  seat_state text,
  host_updated_at timestamptz,
  wait_window_ends_at timestamptz,
  reservation_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_space_status public.space_status;
  v_host_id uuid;
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

  -- In STORY-07, no holds exist yet; seat_state is host_state
  return query
  select
    u.id as unit_id,
    u.host_state as seat_state,
    u.host_updated_at,
    null::timestamptz as wait_window_ends_at,
    null::uuid as reservation_id
  from public.units u
  where u.space_id = p_space_id
  order by u.zone_id, u.grid_row, u.grid_col;
end;
$$;

comment on function public.unit_states(uuid) is
  'Canonical read interface for unit seat states and freshness. STORY-07.';

revoke all on function public.unit_states(uuid) from public;
grant execute on function public.unit_states(uuid) to anon, authenticated;

-- Grants: start from nothing, then give back only what the design's table allows.
-- host_state and host_updated_at are revoked from direct select and update (N15).
revoke all on table public.zones from anon, authenticated;
grant select on table public.zones to anon, authenticated;
grant insert (space_id, name, position) on table public.zones to authenticated;
grant update (name, position) on table public.zones to authenticated;
grant delete on table public.zones to authenticated;

revoke all on table public.units from anon, authenticated;
grant select (id, space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span, created_at, updated_at)
  on table public.units to anon, authenticated;
grant insert (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
  on table public.units to authenticated;
grant update (zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
  on table public.units to authenticated;
grant delete on table public.units to authenticated;

-- Row-Level Security
alter table public.zones enable row level security;

create policy "zones: read when space is visible"
  on public.zones
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = zones.space_id
        and (
          s.status = 'verified'
          or s.host_id = (select auth.uid())
          or (select private.has_role('admin'))
        )
    )
  );

create policy "zones: hosts insert into own spaces"
  on public.zones
  for insert
  to authenticated
  with check (
    (select private.has_role('host'))
    and exists (
      select 1 from public.spaces s
      where s.id = zones.space_id
        and s.host_id = (select auth.uid())
    )
  );

create policy "zones: hosts update own spaces"
  on public.zones
  for update
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = zones.space_id
        and s.host_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.spaces s
      where s.id = zones.space_id
        and s.host_id = (select auth.uid())
    )
  );

create policy "zones: hosts delete own spaces"
  on public.zones
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = zones.space_id
        and s.host_id = (select auth.uid())
    )
  );

alter table public.units enable row level security;

create policy "units: read when space is visible"
  on public.units
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = units.space_id
        and (
          s.status = 'verified'
          or s.host_id = (select auth.uid())
          or (select private.has_role('admin'))
        )
    )
  );

create policy "units: hosts insert into own spaces"
  on public.units
  for insert
  to authenticated
  with check (
    (select private.has_role('host'))
    and exists (
      select 1 from public.spaces s
      where s.id = units.space_id
        and s.host_id = (select auth.uid())
    )
  );

create policy "units: hosts update own spaces"
  on public.units
  for update
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = units.space_id
        and s.host_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.spaces s
      where s.id = units.space_id
        and s.host_id = (select auth.uid())
    )
  );

create policy "units: hosts delete own spaces"
  on public.units
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = units.space_id
        and s.host_id = (select auth.uid())
    )
  );
