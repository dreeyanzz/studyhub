-- STORY-14, TSK-14.1: review moderation and the moderation log.
-- Adds review_moderation_action, review_moderation_events (with RLS and grants),
-- public.moderate_review and public.admin_review_queue.
-- Design: docs/design/STORY-14-admin-console.md §2 (FR-5.2, D-047, D-053, D-080, D-095).
-- Flow: docs/flows/review-lifecycle.md (RV4 to RV8, RP2, N7 to N9, N13, N14).
-- Never edit this file once applied; add a new migration instead.

-- 1. Type (D-080)
create type public.review_moderation_action as enum (
  'hide',
  'remove',
  'restore',
  'dismiss'
);

-- 2. public.review_moderation_events: the moderation log (FR-5.2, D-080)
--    One row per Administrator action, in order, so an Administrator can read a
--    review's full moderation history (e.g. hidden, restored, then hidden again).
create table public.review_moderation_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  action public.review_moderation_action not null,
  -- Null afterwards if that Administrator's account is deleted.
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.review_moderation_events is
  'Append-only moderation log of Administrator review actions. Written only by public.moderate_review. STORY-14 (FR-5.2, D-080).';
comment on column public.review_moderation_events.actor_id is
  'The Administrator who took the action. Null afterwards if that account is deleted.';

-- One review's history newest first, and the cascade from reviews.
create index review_moderation_events_review_created_idx
  on public.review_moderation_events (review_id, created_at desc);
-- Deleting an Administrator's profile sets actor_id to null on their log rows.
create index review_moderation_events_actor_id_idx
  on public.review_moderation_events (actor_id);
-- Serves the Reported list (oldest open report first) and moderate_review's open-report lookup.
create index review_reports_open_review_created_idx
  on public.review_reports (review_id, created_at asc)
  where outcome is null;
-- Serves the Hidden and Removed lists (most recently changed first).
create index reviews_status_changed_at_idx
  on public.reviews (status, status_changed_at desc);

-- 3. Grants and policies on public.review_moderation_events
--    N13: no role is granted insert, update or delete; only moderate_review writes it.
--    N14: only Administrators read it (plain select, design §2).
revoke all on table public.review_moderation_events from anon, authenticated;
grant select on table public.review_moderation_events to authenticated;

alter table public.review_moderation_events enable row level security;

create policy "review_moderation_events: administrators read the moderation log"
  on public.review_moderation_events
  for select
  to authenticated
  using ((select private.has_role('admin')));

-- 4. public.moderate_review(review_id, action, version): RV4 to RV8 and RP2 (D-053, D-080).
--    Only Administrators. Locks the review, refuses stale versions (N9) and disallowed
--    transitions (N8), updates status / closes open reports as each move requires, and
--    appends a row to review_moderation_events.
create or replace function public.moderate_review(
  p_review_id uuid,
  p_action public.review_moderation_action,
  p_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_status public.review_status;
  v_version integer;
  v_new_status public.review_status;
  v_report_outcome public.review_report_outcome;
  v_closed_reports integer := 0;
  v_now timestamptz;
  v_event_id uuid;
begin
  if not (select private.has_role('admin')) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;
  v_caller_id := (select auth.uid());

  -- 1. Lock the review so a concurrent edit or second Administrator serializes here.
  select r.status, r.version
  into v_status, v_version
  from public.reviews r
  where r.id = p_review_id
  for update;

  if not found then
    raise exception 'review not found'
      using errcode = 'P0001', hint = 'not_found';
  end if;

  -- 2. Act only on the version the Administrator saw (N9, D-080).
  if p_version is distinct from v_version then
    raise exception 'review was edited since you read it'
      using errcode = 'P0001', hint = 'stale_version';
  end if;

  -- 3. Allow only RV4 to RV8 (N8).
  if p_action is null then
    raise exception 'moderation action is not allowed'
      using errcode = 'P0001', hint = 'not_allowed';
  elsif v_status = 'visible' and p_action = 'hide' then
    -- RV4: visible -> hidden; open reports close as hidden.
    v_new_status := 'hidden';
    v_report_outcome := 'hidden';
  elsif v_status = 'visible' and p_action = 'remove' then
    -- RV5: visible -> removed; open reports close as removed.
    v_new_status := 'removed';
    v_report_outcome := 'removed';
  elsif v_status = 'visible' and p_action = 'dismiss' then
    -- RV6: visible stays visible; open reports close as dismissed.
    if not exists (
      select 1
      from public.review_reports rr
      where rr.review_id = p_review_id
        and rr.outcome is null
    ) then
      raise exception 'review has no open reports to dismiss'
        using errcode = 'P0001', hint = 'not_allowed';
    end if;
    v_new_status := 'visible';
    v_report_outcome := 'dismissed';
  elsif v_status = 'hidden' and p_action = 'restore' then
    -- RV7: hidden -> visible; reports stay closed.
    v_new_status := 'visible';
    v_report_outcome := null;
  elsif v_status = 'hidden' and p_action = 'remove' then
    -- RV8: hidden -> removed; any open reports close as removed.
    v_new_status := 'removed';
    v_report_outcome := 'removed';
  else
    raise exception 'moderation action is not allowed for this review status'
      using errcode = 'P0001', hint = 'not_allowed';
  end if;

  -- clock_timestamp() keeps sequential moderation actions strictly ordered even inside
  -- one transaction (such as pgTAP tests).
  v_now := clock_timestamp();

  -- 4. Hide, remove and restore update status, status_changed_by and status_changed_at.
  --    Dismiss leaves them unchanged. Ratings and comment are untouched, so
  --    private.bump_review_version() leaves version and edited_at as they were (RV2).
  if p_action in ('hide', 'remove', 'restore') then
    update public.reviews
    set status = v_new_status,
        status_changed_by = v_caller_id,
        status_changed_at = v_now
    where id = p_review_id;
  end if;

  -- 5. RP2: hide, remove and dismiss close every open report on the review, whatever
  --    version it was about. Already-closed reports are left untouched.
  if v_report_outcome is not null then
    update public.review_reports
    set outcome = v_report_outcome,
        closed_by = v_caller_id,
        closed_at = v_now
    where review_id = p_review_id
      and outcome is null;
    get diagnostics v_closed_reports = row_count;
  end if;

  -- 6. Every action adds a row to the moderation log (D-080).
  insert into public.review_moderation_events (review_id, action, actor_id, created_at)
  values (p_review_id, p_action, v_caller_id, v_now)
  returning id into v_event_id;

  return jsonb_build_object(
    'review_id', p_review_id,
    'status', v_new_status,
    'action', p_action,
    'closed_reports', v_closed_reports,
    'event_id', v_event_id,
    'acted_at', v_now
  );
end;
$$;

comment on function public.moderate_review(uuid, public.review_moderation_action, integer) is
  'Moderates a review (hide, remove, restore or dismiss), closing open reports and recording the moderation log. STORY-14 (FR-5.2, D-080).';

revoke all on function public.moderate_review(uuid, public.review_moderation_action, integer)
  from public, anon, authenticated;
grant execute on function public.moderate_review(uuid, public.review_moderation_action, integer)
  to authenticated;

-- 5. public.admin_review_queue(list, page_size, page_offset): the Moderation page's read
--    (design §2). Only Administrators. Lists reported (oldest open report first), hidden
--    and removed (most recent first), each with its open-report count and reports jsonb.
create or replace function public.admin_review_queue(
  p_list text,
  p_page_size integer default 25,
  p_page_offset integer default 0
)
returns table (
  review_id uuid,
  status public.review_status,
  space_id uuid,
  space_name text,
  space_status public.space_status,
  author_id uuid,
  author_full_name text,
  quietness smallint,
  wifi_reliability smallint,
  cleanliness smallint,
  comfort smallint,
  overall numeric,
  comment text,
  version integer,
  edited_at timestamptz,
  created_at timestamptz,
  status_changed_by uuid,
  status_changed_by_full_name text,
  status_changed_at timestamptz,
  open_report_count integer,
  reports jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page_size integer;
  v_page_offset integer;
begin
  if not (select private.has_role('admin')) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  if p_list is null or p_list not in ('reported', 'hidden', 'removed') then
    raise exception 'the list must be reported, hidden or removed'
      using errcode = 'P0001', hint = 'invalid_list';
  end if;

  -- One more than the 100 the page shows at most, so it can tell whether there are more.
  v_page_size := greatest(1, least(coalesce(p_page_size, 25), 101));
  v_page_offset := greatest(0, coalesce(p_page_offset, 0));

  -- Administrators may read full names already (STORY-01's profiles policy).
  return query
  select
    r.id,
    r.status,
    s.id,
    s.name,
    s.status,
    r.author_id,
    author.full_name,
    r.quietness,
    r.wifi_reliability,
    r.cleanliness,
    r.comfort,
    round((r.quietness + r.wifi_reliability + r.cleanliness + r.comfort) / 4.0, 2),
    r.comment,
    r.version,
    r.edited_at,
    r.created_at,
    r.status_changed_by,
    changer.full_name,
    r.status_changed_at,
    coalesce(rep.open_count, 0)::integer,
    coalesce(rep.items, '[]'::jsonb)
  from public.reviews r
  join public.spaces s on s.id = r.space_id
  join public.profiles author on author.id = r.author_id
  left join public.profiles changer on changer.id = r.status_changed_by
  left join lateral (
    select
      count(*) filter (where rr.outcome is null) as open_count,
      min(rr.created_at) filter (where rr.outcome is null) as oldest_open_at,
      jsonb_agg(
        jsonb_build_object(
          'id', rr.id,
          'reporter_id', rr.reporter_id,
          'reporter_full_name', reporter.full_name,
          'reason', rr.reason,
          'note', rr.note,
          'review_version', rr.review_version,
          'created_at', rr.created_at,
          'outcome', rr.outcome,
          'closed_by', rr.closed_by,
          'closed_by_full_name', closer.full_name,
          'closed_at', rr.closed_at
        )
        order by rr.created_at asc, rr.id asc
      ) as items
    from public.review_reports rr
    join public.profiles reporter on reporter.id = rr.reporter_id
    left join public.profiles closer on closer.id = rr.closed_by
    where rr.review_id = r.id
  ) rep on true
  where (
    (p_list = 'reported' and r.status = 'visible' and coalesce(rep.open_count, 0) > 0)
    or (p_list = 'hidden' and r.status = 'hidden')
    or (p_list = 'removed' and r.status = 'removed')
  )
  order by
    case when p_list = 'reported' then rep.oldest_open_at end asc,
    case when p_list in ('hidden', 'removed') then r.status_changed_at end desc nulls last,
    r.created_at desc,
    r.id desc
  limit v_page_size
  offset v_page_offset;
end;
$$;

comment on function public.admin_review_queue(text, integer, integer) is
  'Lists reported (oldest open report first), hidden or removed reviews (most recent first) for Administrators, each with its reports. STORY-14 (FR-5.2, D-080).';

revoke all on function public.admin_review_queue(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_review_queue(text, integer, integer)
  to authenticated;
