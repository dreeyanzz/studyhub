-- STORY-08 performance follow-up: single-query discovery read for /spaces (FR-1.1,
-- FR-1.2, D-007, D-047, D-055, D-063, D-076). Never edit this file once applied;
-- add a new migration instead.
--
-- Replaces the multi-round-trip spaces + space_review_summary + N storage.list()
-- waterfall on /spaces with one stable SQL function returning every Verified Space's
-- public listing data, curated and custom tags, distinct unit types, visible review
-- summary, and earliest non-dotfile cover photo path.
--
-- Runs as security invoker so Row-Level Security on every table (and storage.objects)
-- still applies, while explicitly filtering s.status = 'verified' and r.status = 'visible'
-- so non-Verified Spaces and hidden/removed reviews are never exposed even when called
-- by an owning Host or an Administrator (D-055, D-080).

create function public.discovery_spaces()
returns table (
  id uuid,
  name text,
  description text,
  address text,
  opens_at time,
  closes_at time,
  latitude double precision,
  longitude double precision,
  price_tier public.price_tier,
  curated_tags jsonb,
  custom_tags text[],
  unit_types public.unit_type[],
  review_count integer,
  avg_overall numeric,
  cover_photo_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with verified_spaces as (
    select
      s.id,
      s.name,
      s.description,
      s.address,
      s.opens_at,
      s.closes_at,
      s.latitude,
      s.longitude,
      s.price_tier
    from public.spaces s
    where s.status = 'verified'
  ),
  curated_by_space as (
    select
      sct.space_id,
      jsonb_agg(
        jsonb_build_object(
          'id', ct.id,
          'label', ct.label,
          'category', ct.category
        )
        order by ct.category, ct.display_order, ct.label
      ) as curated_tags
    from public.space_curated_tags sct
    join public.curated_tags ct on ct.id = sct.tag_id
    where sct.space_id in (select vs.id from verified_spaces vs)
    group by sct.space_id
  ),
  custom_by_space as (
    select
      cu.space_id,
      array_agg(cu.name order by cu.created_at, cu.id) as custom_tags
    from public.space_custom_tags cu
    where cu.space_id in (select vs.id from verified_spaces vs)
    group by cu.space_id
  ),
  unit_types_by_space as (
    select
      u.space_id,
      array_agg(distinct u.unit_type order by u.unit_type) as unit_types
    from public.units u
    where u.space_id in (select vs.id from verified_spaces vs)
    group by u.space_id
  ),
  reviews_by_space as (
    select
      r.space_id,
      count(r.id)::integer as review_count,
      avg((r.quietness + r.wifi_reliability + r.cleanliness + r.comfort) / 4.0) as avg_overall
    from public.reviews r
    where r.space_id in (select vs.id from verified_spaces vs)
      and r.status = 'visible'
    group by r.space_id
  ),
  covers_by_space as (
    select distinct on ((storage.foldername(o.name))[1])
      (storage.foldername(o.name))[1] as space_id_text,
      o.name as cover_photo_path
    from storage.objects o
    where o.bucket_id = 'space-photos'
      and array_length(storage.foldername(o.name), 1) = 1
      and (storage.foldername(o.name))[1] in (select vs.id::text from verified_spaces vs)
      and split_part(o.name, '/', 2) <> ''
      and left(split_part(o.name, '/', 2), 1) <> '.'
    order by
      (storage.foldername(o.name))[1],
      o.created_at asc nulls last,
      o.name asc
  )
  select
    vs.id,
    vs.name,
    vs.description,
    vs.address,
    vs.opens_at,
    vs.closes_at,
    vs.latitude,
    vs.longitude,
    vs.price_tier,
    coalesce(ct.curated_tags, '[]'::jsonb) as curated_tags,
    coalesce(cu.custom_tags, '{}'::text[]) as custom_tags,
    coalesce(ut.unit_types, '{}'::public.unit_type[]) as unit_types,
    coalesce(rv.review_count, 0) as review_count,
    rv.avg_overall,
    cv.cover_photo_path
  from verified_spaces vs
  left join curated_by_space ct on ct.space_id = vs.id
  left join custom_by_space cu on cu.space_id = vs.id
  left join unit_types_by_space ut on ut.space_id = vs.id
  left join reviews_by_space rv on rv.space_id = vs.id
  left join covers_by_space cv on cv.space_id_text = vs.id::text
  order by vs.name asc, vs.id asc;
$$;

comment on function public.discovery_spaces() is
  'Public discovery catalog for /spaces: Verified Spaces with tags, unit types, visible review summary, and oldest cover photo path (STORY-08, D-055, D-063, D-076).';

revoke all on function public.discovery_spaces() from public, anon, authenticated;
grant execute on function public.discovery_spaces() to anon, authenticated;
