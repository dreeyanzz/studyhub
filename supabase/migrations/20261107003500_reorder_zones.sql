-- STORY-07, TSK-07.3: public.reorder_zones for atomic zone reordering.
-- Design: docs/design/STORY-07-seat-map-builder.md. Never edit this file once applied;
-- add a new migration instead.

create or replace function public.reorder_zones(
  p_space_id uuid,
  p_zone_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_id uuid;
  v_count integer;
  i integer;
begin
  select host_id into v_host_id
  from public.spaces
  where id = p_space_id;

  if not found or v_host_id is distinct from (select auth.uid()) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  if p_zone_ids is null or array_length(p_zone_ids, 1) is null then
    return;
  end if;

  select count(*) into v_count
  from public.zones
  where space_id = p_space_id
    and id = any(p_zone_ids);

  if v_count <> array_length(p_zone_ids, 1) then
    raise exception 'Zone does not exist or does not belong to Space'
      using errcode = '23503';
  end if;

  for i in 1 .. array_length(p_zone_ids, 1) loop
    update public.zones
    set position = (i - 1)
    where id = p_zone_ids[i]
      and space_id = p_space_id;
  end loop;
end;
$$;

comment on function public.reorder_zones(uuid, uuid[]) is
  'Atomically updates zone positions for a Space. STORY-07.';

revoke all on function public.reorder_zones(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_zones(uuid, uuid[]) to authenticated;
