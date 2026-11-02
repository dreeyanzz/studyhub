-- STORY-07, TSK-07.2: space-photos storage bucket and policies (D-063).
-- Design: docs/design/STORY-07-seat-map-builder.md §2.
-- Public bucket for venue photos, capped at 5 MB and restricted to JPEG, PNG, WebP.
-- Photos live at <space_id>/<file name>, one folder deep: the insert and update
-- policies refuse anything deeper. deleteSpace empties a Space by listing that one
-- folder, and a listing shows a deeper path as a folder it cannot remove, so one
-- such photo would make the Space impossible to delete.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'space-photos',
  'space-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Policies on storage.objects, scoped to space-photos only (D-063).
-- Note: Each policy uses (storage.foldername(objects.name))[1] to qualify objects.name,
-- avoiding ambiguity with public.spaces.name.
-- Comparing with s.id::text prevents runtime cast errors if an object path has no valid UUID.

create policy "space_photos: list photos of visible spaces"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'space-photos'
    and exists (
      select 1 from public.spaces s
      where s.id::text = (storage.foldername(objects.name))[1]
        and (
          s.status = 'verified'
          or s.host_id = (select auth.uid())
          or (select private.has_role('admin'))
        )
    )
  );

create policy "space_photos: hosts upload photos to own spaces"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'space-photos'
    and array_length(storage.foldername(objects.name), 1) = 1
    and exists (
      select 1 from public.spaces s
      where s.id::text = (storage.foldername(objects.name))[1]
        and s.host_id = (select auth.uid())
    )
  );

create policy "space_photos: hosts update photos in own spaces"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'space-photos'
    and exists (
      select 1 from public.spaces s
      where s.id::text = (storage.foldername(objects.name))[1]
        and s.host_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'space-photos'
    and array_length(storage.foldername(objects.name), 1) = 1
    and exists (
      select 1 from public.spaces s
      where s.id::text = (storage.foldername(objects.name))[1]
        and s.host_id = (select auth.uid())
    )
  );

create policy "space_photos: hosts delete photos from own spaces"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'space-photos'
    and exists (
      select 1 from public.spaces s
      where s.id::text = (storage.foldername(objects.name))[1]
        and s.host_id = (select auth.uid())
    )
  );
