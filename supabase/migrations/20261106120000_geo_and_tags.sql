-- STORY-08, TSK-08.1: space coordinates, price tier, curated & custom tag tables, RLS policies, revoke all.
-- Design: docs/design/STORY-08-geo-discovery.md. Never edit this file once applied;
-- add a new migration instead.

-- 1. Price tier enum and space columns (D-027, D-066)
create type public.price_tier as enum ('free', 'budget', 'standard', 'premium');

alter table public.spaces
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column price_tier public.price_tier not null default 'budget';

comment on column public.spaces.latitude is 'WGS 84 latitude coordinate for Leaflet map pin. STORY-08.';
comment on column public.spaces.longitude is 'WGS 84 longitude coordinate for Leaflet map pin. STORY-08.';
comment on column public.spaces.price_tier is 'Curated price tier for Seeker filtering and pin display. STORY-08.';

-- Update column grants for authenticated Hosts (used in SpaceForm create and edit)
grant insert (latitude, longitude, price_tier)
  on table public.spaces to authenticated;
grant update (latitude, longitude, price_tier)
  on table public.spaces to authenticated;

-- 2. Curated tags catalog: public.curated_tags
create table public.curated_tags (
  id text primary key,
  category text not null check (category in (
    'wifi', 'power', 'noise', 'ac'
  )),
  label text not null check (char_length(btrim(label)) >= 1 and char_length(label) <= 50),
  description text check (char_length(description) <= 200),
  display_order smallint not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.curated_tags is 'Platform-curated amenity tags powering search filters. STORY-08.';

alter table public.curated_tags enable row level security;

-- Explicit revoke all before grants (D-007)
revoke all on table public.curated_tags from anon, authenticated;
grant select on table public.curated_tags to anon, authenticated;

create policy "curated_tags: publicly readable"
  on public.curated_tags
  for select
  to anon, authenticated
  using (true);

-- 3. Space curated tags junction: public.space_curated_tags
create table public.space_curated_tags (
  space_id uuid not null references public.spaces (id) on delete cascade,
  tag_id text not null references public.curated_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (space_id, tag_id)
);

comment on table public.space_curated_tags is 'Curated amenity tags assigned to a Space by its Host. STORY-08.';

create index space_curated_tags_tag_id_idx on public.space_curated_tags (tag_id);

alter table public.space_curated_tags enable row level security;

-- Explicit revoke all before grants (D-007)
revoke all on table public.space_curated_tags from anon, authenticated;
grant select, insert, delete on table public.space_curated_tags to authenticated;
grant select on table public.space_curated_tags to anon;

create policy "space_curated_tags: read tags of visible spaces"
  on public.space_curated_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = space_curated_tags.space_id
        and (
          s.status = 'verified'
          or s.host_id = (select auth.uid())
          or (select private.has_role('admin'))
        )
    )
  );

create policy "space_curated_tags: hosts manage tags for own spaces"
  on public.space_curated_tags
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.spaces s
      where s.id = space_curated_tags.space_id
        and s.host_id = (select auth.uid())
        and (select private.has_role('host'))
    )
  );

create policy "space_curated_tags: hosts delete tags for own spaces"
  on public.space_curated_tags
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = space_curated_tags.space_id
        and s.host_id = (select auth.uid())
        and (select private.has_role('host'))
    )
  );

-- 4. Space custom tags: public.space_custom_tags
create table public.space_custom_tags (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (
    char_length(btrim(name)) >= 1
    and char_length(name) <= 30
    and name !~ '[<>{}\\]'
  ),
  created_at timestamptz not null default now()
);

comment on table public.space_custom_tags is 'Host-defined free-text tags for display only. STORY-08.';

create unique index space_custom_tags_space_lower_name_idx
  on public.space_custom_tags (space_id, lower(name));
create index space_custom_tags_space_id_idx on public.space_custom_tags (space_id);

alter table public.space_custom_tags enable row level security;

-- Explicit revoke all before grants (D-007)
revoke all on table public.space_custom_tags from anon, authenticated;
grant select, insert, delete on table public.space_custom_tags to authenticated;
grant select on table public.space_custom_tags to anon;

create policy "space_custom_tags: read tags of visible spaces"
  on public.space_custom_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = space_custom_tags.space_id
        and (
          s.status = 'verified'
          or s.host_id = (select auth.uid())
          or (select private.has_role('admin'))
        )
    )
  );

create policy "space_custom_tags: hosts manage custom tags for own spaces"
  on public.space_custom_tags
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.spaces s
      where s.id = space_custom_tags.space_id
        and s.host_id = (select auth.uid())
        and (select private.has_role('host'))
    )
  );

create policy "space_custom_tags: hosts delete custom tags for own spaces"
  on public.space_custom_tags
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
      where s.id = space_custom_tags.space_id
        and s.host_id = (select auth.uid())
        and (select private.has_role('host'))
    )
  );

-- 5. Seed curated tags catalog
insert into public.curated_tags (id, category, label, description, display_order)
values
  ('wifi_basic', 'wifi', 'Wi-Fi: Standard (10+ Mbps)', 'Basic internet suitable for reading and email', 1),
  ('wifi_fast', 'wifi', 'Wi-Fi: Fast (50+ Mbps)', 'High-speed internet suitable for video calls', 2),
  ('wifi_ultrafast', 'wifi', 'Wi-Fi: Ultra-Fast (100+ Mbps)', 'Gigabit / fiber connection for heavy workflows', 3),
  ('outlets_all', 'power', 'Outlets: Every Seat', 'Dedicated power outlet at every workstation', 1),
  ('outlets_some', 'power', 'Outlets: Shared / Common', 'Accessible outlets in common areas', 2),
  ('noise_silent', 'noise', 'Noise: Silent Study', 'Strictly silent; no talking or calls permitted', 1),
  ('noise_quiet', 'noise', 'Noise: Quiet Focus', 'Low murmurs permitted; headphone study', 2),
  ('noise_moderate', 'noise', 'Noise: Collaborative', 'Conversational and group discussions permitted', 3),
  ('ac_full', 'ac', 'Air Conditioning', 'Full air-conditioning throughout the venue', 1),
  ('ac_natural', 'ac', 'Natural Ventilation', 'Open-air, ceiling fans or natural breeze', 2)
on conflict (id) do nothing;
