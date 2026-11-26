-- STORY-14 fix (#420): refuse a moderation action on a review that another
-- Administrator moderated since this one read it (review lifecycle N18).
-- Replaces public.moderate_review(uuid, review_moderation_action, integer) with a
-- version that also takes the newest moderation log entry the Administrator saw.
-- Design: docs/design/STORY-14-admin-console.md §2 (FR-5.2, D-053, D-080).
-- Flow: docs/flows/review-lifecycle.md (N9, N18).
-- Never edit this file once applied; add a new migration instead.

-- A new argument is a new signature, so the old function goes first. Otherwise a
-- three-argument call would match both and fail as ambiguous.
drop function public.moderate_review(uuid, public.review_moderation_action, integer);

-- p_last_event_id is the newest row of the review's moderation log when the
-- Administrator read it, or null when the log was empty. Leaving it out means null,
-- so a caller that doesn't send it is refused once the review has any history.
create function public.moderate_review(
  p_review_id uuid,
  p_action public.review_moderation_action,
  p_version integer,
  p_last_event_id uuid default null
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
  v_last_event_id uuid;
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

  -- 3. Act only if nobody moderated it since the Administrator read it (N18). Every
  --    action locks the review first, so its newest log row can't change under us.
  --    The order matches the page's history read (lib/data/admin.ts).
  select e.id
  into v_last_event_id
  from public.review_moderation_events e
  where e.review_id = p_review_id
  order by e.created_at desc, e.id desc
  limit 1;

  if v_last_event_id is distinct from p_last_event_id then
    raise exception 'review was moderated since you read it'
      using errcode = 'P0001', hint = 'stale_version';
  end if;

  -- 4. Allow only RV4 to RV8 (N8).
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

  -- 5. Hide, remove and restore update status, status_changed_by and status_changed_at.
  --    Dismiss leaves them unchanged. Ratings and comment are untouched, so
  --    private.bump_review_version() leaves version and edited_at as they were (RV2).
  if p_action in ('hide', 'remove', 'restore') then
    update public.reviews
    set status = v_new_status,
        status_changed_by = v_caller_id,
        status_changed_at = v_now
    where id = p_review_id;
  end if;

  -- 6. RP2: hide, remove and dismiss close every open report on the review, whatever
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

  -- 7. Every action adds a row to the moderation log (D-080).
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

comment on function public.moderate_review(uuid, public.review_moderation_action, integer, uuid) is
  'Moderates a review (hide, remove, restore or dismiss) the Administrator read at this version and moderation log entry, closing open reports and recording the moderation log. STORY-14 (FR-5.2, D-080, #420).';

revoke all on function public.moderate_review(uuid, public.review_moderation_action, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.moderate_review(uuid, public.review_moderation_action, integer, uuid)
  to authenticated;
