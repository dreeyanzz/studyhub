-- STORY-13, TSK-13.1: reviews and review reports, their policies, grants and triggers,
-- the two private helpers and the three read functions.
-- Design: docs/design/STORY-13-reviews.md §2. Flow: docs/flows/review-lifecycle.md
-- (RV1 to RV3, RV9, RP1, RP3, N1 to N6, N10 to N12, N15 to N17). Never edit this file
-- once applied; add a new migration instead.
--
-- STORY-14 writes status, status_changed_by, status_changed_at and a report's outcome,
-- closed_by and closed_at through public.moderate_review. They are created here so that
-- STORY-14 adds no columns to these tables.

-- 1. Types (D-080)
create type public.review_status as enum ('visible', 'hidden', 'removed');

create type public.review_report_reason as enum (
  'spam',
  'offensive',
  'not_about_space',
  'other'
);

create type public.review_report_outcome as enum ('dismissed', 'hidden', 'removed');

-- 2. public.reviews: one per visit (FR-4.1, D-076, D-081)
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  -- One review per visit, whatever its status (N2). Goes with its visit (RV9).
  reservation_id uuid not null unique
    references public.reservations (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  author_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  -- 1 to 5, where 5 is best for all four. Quietness is FR-4.1's "noise" (D-087).
  quietness smallint not null check (quietness between 1 and 5),
  wifi_reliability smallint not null check (wifi_reliability between 1 and 5),
  cleanliness smallint not null check (cleanliness between 1 and 5),
  comfort smallint not null check (comfort between 1 and 5),
  -- Null, or not blank and at most 500 characters (N15). The form trims it and sends
  -- an empty one as null.
  comment text
    check (char_length(btrim(comment)) >= 1 and char_length(comment) <= 500),
  status public.review_status not null default 'visible',
  version integer not null default 1 check (version >= 1),
  edited_at timestamptz,
  status_changed_by uuid references public.profiles (id) on delete set null,
  status_changed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.reviews is
  'A Seeker''s review of a visit: four 1-5 ratings and an optional comment. STORY-13 (FR-4.1, D-076, D-080, D-081).';
comment on column public.reviews.status is
  'visible, hidden or removed. Never granted to any role: only public.moderate_review (STORY-14) changes it.';
comment on column public.reviews.version is
  '1 when posted, raised by 1 on each edit of a rating or the comment. A report records the version it was about (D-080).';
comment on column public.reviews.edited_at is
  'Null until the first edit. The app shows "Edited" once it is set.';
comment on column public.reviews.created_at is
  'The date a review shows. The visit''s date is never shown (design §7).';

-- The Space profile's list: a Space's visible reviews, newest first.
create index reviews_space_status_created_idx
  on public.reviews (space_id, status, created_at desc);
-- The author's own reviews, and the cascade from profiles.
create index reviews_author_id_idx on public.reviews (author_id);

-- 3. public.review_reports: one per reporter per version (FR-4.2, D-080)
create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  reporter_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  -- Set by private.set_review_report_version(), never by the reporter.
  review_version integer not null,
  reason public.review_report_reason not null,
  note text
    check (char_length(btrim(note)) >= 1 and char_length(note) <= 300),
  outcome public.review_report_outcome,
  closed_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  -- A user reports each version of a review once (N11).
  constraint review_reports_one_per_reporter_per_version
    unique (review_id, reporter_id, review_version),
  -- Open: none of the three. Closed: an outcome and when. closed_by is set on closing
  -- too, but may be null afterwards, when that Administrator's account is deleted, as
  -- payments.refunded_by may (STORY-14 §2); otherwise the set null would fail this check.
  constraint review_reports_closed_together
    check (
      (outcome is null and closed_by is null and closed_at is null)
      or (outcome is not null and closed_at is not null)
    )
);

comment on table public.review_reports is
  'A user''s report of a review, about the version it had when reported. Closed only by public.moderate_review (STORY-14). STORY-13 (FR-4.2, D-080).';

create index review_reports_reporter_id_idx on public.review_reports (reporter_id);

-- 4. Triggers
-- RV2: an edit of a rating or the comment raises version and sets edited_at. A change
-- to the status alone (STORY-14) leaves both as they were. "is distinct from" counts
-- adding a comment to a review that had none, or clearing it, as an edit.
create function private.bump_review_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.quietness is distinct from old.quietness
    or new.wifi_reliability is distinct from old.wifi_reliability
    or new.cleanliness is distinct from old.cleanliness
    or new.comfort is distinct from old.comfort
    or new.comment is distinct from old.comment
  then
    new.version := old.version + 1;
    new.edited_at := now();
  end if;

  return new;
end;
$$;

comment on function private.bump_review_version() is
  'Raises a review''s version and sets edited_at when a rating or the comment changes (RV2). STORY-13.';

revoke all on function private.bump_review_version() from public, anon, authenticated;

create trigger bump_review_version
  before update on public.reviews
  for each row execute function private.bump_review_version();

-- A report is about the text that was there when it was filed (D-080). Security definer,
-- so it reads the review whatever its status; the insert policy then refuses a review the
-- reporter may not report. A review that doesn't exist leaves the version null, which the
-- insert policy refuses too.
create function private.set_review_report_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.review_version := (
    select r.version
    from public.reviews r
    where r.id = new.review_id
  );

  return new;
end;
$$;

comment on function private.set_review_report_version() is
  'Records the review''s current version on a new report (D-080). STORY-13.';

revoke all on function private.set_review_report_version() from public, anon, authenticated;

create trigger set_review_report_version
  before insert on public.review_reports
  for each row execute function private.set_review_report_version();

-- 5. Private helpers
-- "Juan dela Cruz" reads "Juan C.", a one-word name reads as it is, and an empty or
-- null name reads "Worq Seeker" (D-081). Granted to no role: only the security definer
-- reads below call it.
create function private.reviewer_short_name(p_full_name text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(coalesce(p_full_name, ''), '^\s+|\s+$', '', 'g');
  v_words text[];
begin
  if v_name = '' then
    return 'Worq Seeker';
  end if;

  v_words := regexp_split_to_array(v_name, '\s+');

  if cardinality(v_words) = 1 then
    return v_words[1];
  end if;

  return v_words[1] || ' ' || left(v_words[cardinality(v_words)], 1) || '.';
end;
$$;

comment on function private.reviewer_short_name(text) is
  'A reviewer''s short name: the first word and the last word''s initial (D-081, N17). STORY-13.';

revoke all on function private.reviewer_short_name(text) from public, anon, authenticated;

-- True when the reservation is the caller's visit to that Space: theirs, checked in,
-- and under that Space (RV1, N1). No role may read reservations (D-047), so the insert
-- policy asks this instead. A policy runs as the caller, so authenticated must be able
-- to run it, as it can private.has_role; without the grant every post fails with 42501.
create function private.is_reviewable_visit(p_reservation_id uuid, p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reservations r
    where r.id = p_reservation_id
      and r.seeker_id = (select auth.uid())
      and r.checked_in_at is not null
      and r.space_id = p_space_id
  );
$$;

comment on function private.is_reviewable_visit(uuid, uuid) is
  'Whether a reservation is the caller''s visit to a Space, for the reviews insert policy (RV1, N1). STORY-13.';

revoke all on function private.is_reviewable_visit(uuid, uuid) from public, anon, authenticated;
grant execute on function private.is_reviewable_visit(uuid, uuid) to authenticated;

-- 6. Grants: start from nothing, then give back only what the design allows. No role is
-- granted author_id, status, version, edited_at or the status_changed_ columns, so
-- writing them fails with 42501 whatever the policies say, Administrators included (N6).
-- No role may update or delete a report (N13).
revoke all on table public.reviews from anon, authenticated;
grant select on table public.reviews to anon, authenticated;
grant insert (
  reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort, comment
) on table public.reviews to authenticated;
grant update (quietness, wifi_reliability, cleanliness, comfort, comment)
  on table public.reviews to authenticated;
grant delete on table public.reviews to authenticated;

revoke all on table public.review_reports from anon, authenticated;
grant select on table public.review_reports to authenticated;
grant insert (review_id, reason, note) on table public.review_reports to authenticated;

-- 7. Policies
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;

-- N10: visible reviews of a Verified Space for everyone, signed-out visitors included;
-- the author's own in any status; every review for Administrators.
create policy "reviews: read visible on verified spaces, own, or any as an administrator"
  on public.reviews
  for select
  to anon, authenticated
  using (
    (
      status = 'visible'
      and exists (
        select 1
        from public.spaces s
        where s.id = reviews.space_id
          and s.status = 'verified'
      )
    )
    or author_id = (select auth.uid())
    or (select private.has_role('admin'))
  );

-- RV1: a Seeker reviews their own visit, whatever its Space's status (D-081). The
-- unique key on reservation_id refuses a second review of one visit (N2).
create policy "reviews: seekers review their own visits"
  on public.reviews
  for insert
  to authenticated
  with check (
    (select private.has_role('seeker'))
    and author_id = (select auth.uid())
    and private.is_reviewable_visit(reservation_id, space_id)
  );

-- RV2: the author edits their own review while it is visible (N4, N5).
create policy "reviews: authors edit their own visible reviews"
  on public.reviews
  for update
  to authenticated
  using (author_id = (select auth.uid()) and status = 'visible')
  with check (author_id = (select auth.uid()) and status = 'visible');

-- RV3: the author deletes their own review while it is visible (N4, N5). Its reports go
-- with it (RP3), and the visit can be reviewed again.
create policy "reviews: authors delete their own visible reviews"
  on public.reviews
  for delete
  to authenticated
  using (author_id = (select auth.uid()) and status = 'visible');

-- N12: the reporter's own reports, and every report for Administrators.
create policy "review_reports: read own, or any as an administrator"
  on public.review_reports
  for select
  to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select private.has_role('admin'))
  );

-- RP1, N11: a signed-in user who isn't its author reports a visible review of a
-- Verified Space, at the version the trigger recorded. The subquery reads reviews and
-- spaces as the caller. The unique key refuses the same version twice.
create policy "review_reports: report a visible review that isn't your own"
  on public.review_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1
      from public.reviews r
      join public.spaces s on s.id = r.space_id
      where r.id = review_reports.review_id
        and r.status = 'visible'
        and s.status = 'verified'
        and r.author_id is distinct from (select auth.uid())
        and r.version = review_reports.review_version
    )
  );

-- 8. Read functions. Each runs as security definer with an empty search_path, revokes
-- execute from public, anon and authenticated, and grants exactly what the design says
-- (D-047).

-- Others' visible reviews of a Verified Space, with the reviewer's short name, never
-- the full name (N10, N17, D-055). It leaves out the caller's own, which the page reads
-- from reviews itself; "is distinct from" keeps every review for a signed-out visitor,
-- whose auth.uid() is null. p_page_size is clamped to 1 to 51 (one more than the 50 the
-- page shows, so it can tell whether there are more), and p_page_offset to 0 or more.
create function public.space_reviews(
  p_space_id uuid,
  p_sort text default 'newest',
  p_page_size integer default 10,
  p_page_offset integer default 0
)
returns table (
  id uuid,
  reviewer_name text,
  quietness smallint,
  wifi_reliability smallint,
  cleanliness smallint,
  comfort smallint,
  overall numeric,
  comment text,
  created_at timestamptz,
  edited boolean,
  version integer,
  reported_by_caller boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 51);
  v_page_offset integer := greatest(coalesce(p_page_offset, 0), 0);
begin
  if p_sort is null or p_sort not in ('newest', 'highest', 'lowest') then
    raise exception 'invalid_sort'
      using errcode = 'P0001', hint = 'invalid_sort';
  end if;

  if not exists (
    select 1
    from public.spaces s
    where s.id = p_space_id
      and s.status = 'verified'
  ) then
    return;
  end if;

  -- A review's overall rating is the average of its four, worked out here and never
  -- stored (D-076). It is a multiple of 0.25, so two decimals hold it exactly.
  return query
  select
    r.id,
    private.reviewer_short_name(p.full_name),
    r.quietness,
    r.wifi_reliability,
    r.cleanliness,
    r.comfort,
    round((r.quietness + r.wifi_reliability + r.cleanliness + r.comfort) / 4.0, 2),
    r.comment,
    r.created_at,
    r.edited_at is not null,
    r.version,
    exists (
      select 1
      from public.review_reports rr
      where rr.review_id = r.id
        and rr.reporter_id = v_caller
        and rr.review_version = r.version
    )
  from public.reviews r
  join public.profiles p on p.id = r.author_id
  where r.space_id = p_space_id
    and r.status = 'visible'
    and r.author_id is distinct from v_caller
  order by
    case when p_sort = 'highest'
      then r.quietness + r.wifi_reliability + r.cleanliness + r.comfort end desc,
    case when p_sort = 'lowest'
      then r.quietness + r.wifi_reliability + r.cleanliness + r.comfort end asc,
    r.created_at desc,
    r.id desc
  limit v_page_size
  offset v_page_offset;
end;
$$;

comment on function public.space_reviews(uuid, text, integer, integer) is
  'Others'' visible reviews of a Verified Space with short names, sorted newest, highest or lowest, and paged. STORY-13 (N10, N17, D-081).';

revoke all on function public.space_reviews(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.space_reviews(uuid, text, integer, integer)
  to anon, authenticated;

-- One row for each of those Spaces that is Verified: the count of its visible reviews,
-- the average of each rating and the overall average (N16, D-076). A Space with no
-- visible review has a count of 0 and null averages; one that isn't Verified has no row.
-- The averages are not rounded, so the app rounds once, for display. At most 100 ids at
-- once: search calls it in batches of 100.
create function public.space_review_summary(p_space_ids uuid[])
returns table (
  space_id uuid,
  review_count integer,
  avg_quietness numeric,
  avg_wifi_reliability numeric,
  avg_cleanliness numeric,
  avg_comfort numeric,
  avg_overall numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if cardinality(p_space_ids) > 100 then
    raise exception 'too_many_spaces'
      using errcode = 'P0001', hint = 'too_many_spaces';
  end if;

  return query
  select
    s.id,
    count(r.id)::integer,
    avg(r.quietness),
    avg(r.wifi_reliability),
    avg(r.cleanliness),
    avg(r.comfort),
    avg((r.quietness + r.wifi_reliability + r.cleanliness + r.comfort) / 4.0)
  from public.spaces s
  left join public.reviews r
    on r.space_id = s.id
   and r.status = 'visible'
  where s.id = any (p_space_ids)
    and s.status = 'verified'
  group by s.id
  order by s.id;
end;
$$;

comment on function public.space_review_summary(uuid[]) is
  'Review count and averages of visible reviews, for up to 100 Verified Spaces. STORY-13 (N16, D-076).';

revoke all on function public.space_review_summary(uuid[]) from public, anon, authenticated;
grant execute on function public.space_review_summary(uuid[]) to anon, authenticated;

-- The caller's newest visit to the Space that has no review in any status: a hidden or
-- removed review keeps its visit used (D-081). Only a Seeker can have one. No lapse step
-- is needed, because a visit's check-in never changes once it is made.
create function public.my_reviewable_visit(p_space_id uuid)
returns table (
  reservation_id uuid,
  checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.checked_in_at
  from public.reservations r
  where r.seeker_id = (select auth.uid())
    and r.space_id = p_space_id
    and r.checked_in_at is not null
    and (select private.has_role('seeker'))
    and not exists (
      select 1
      from public.reviews v
      where v.reservation_id = r.id
    )
  order by r.checked_in_at desc, r.id desc
  limit 1;
$$;

comment on function public.my_reviewable_visit(uuid) is
  'The caller''s newest visit to a Space with no review yet, or no row. STORY-13 (RV1, D-081).';

revoke all on function public.my_reviewable_visit(uuid) from public, anon, authenticated;
grant execute on function public.my_reviewable_visit(uuid) to authenticated;
