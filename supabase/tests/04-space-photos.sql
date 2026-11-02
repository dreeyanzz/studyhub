-- STORY-07, TSK-07.2: space-photos storage bucket and policies (D-063).
-- The cases follow the design's §4 matrix (docs/design/STORY-07-seat-map-builder.md).
-- Uses the accounts and spaces from supabase/seed.sql:
--   admin  a0000000-0000-4000-8000-000000000001
--   host   b0000000-0000-4000-8000-000000000001  owns e…01 (verified), e…02 (pending)
--   host2  b0000000-0000-4000-8000-000000000002  owns e…03 (verified)
--   seeker c0000000-0000-4000-8000-000000000001

begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- Set allow_delete_query for the test transaction so DELETE policies can be tested
-- without triggering storage.protect_delete() refusal.
set local storage.allow_delete_query = true;

-- Bucket configuration verification
select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'space-photos'$$,
  $$values (true, 5242880::bigint, array['image/jpeg', 'image/png', 'image/webp'])$$,
  'space-photos bucket is public with 5MB limit and allowed image mime types'
);

-- Pre-seed test objects as postgres (bypassing RLS)
insert into storage.objects (id, bucket_id, name)
values
  ('10000000-0000-4000-8000-000000000001', 'space-photos', 'e0000000-0000-4000-8000-000000000001/hall.jpg'),
  ('10000000-0000-4000-8000-000000000002', 'space-photos', 'e0000000-0000-4000-8000-000000000002/night.jpg'),
  ('10000000-0000-4000-8000-000000000003', 'space-photos', 'e0000000-0000-4000-8000-000000000003/sulok.jpg');

-- ---------------------------------------------------------------------------
-- 1. An anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000001/%'$$,
  $$values ('e0000000-0000-4000-8000-000000000001/hall.jpg')$$,
  'an anonymous visitor lists photos of a verified space'
);

select is_empty(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000002/%'$$,
  'an anonymous visitor gets 0 rows for a pending space''s photos'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('space-photos', 'e0000000-0000-4000-8000-000000000001/visitor.jpg')$$,
  '42501',
  null,
  'a visitor cannot upload photos'
);

select is_empty(
  $$update storage.objects set name = 'e0000000-0000-4000-8000-000000000001/anon_rename.jpg' where id = '10000000-0000-4000-8000-000000000001' returning id$$,
  'an anonymous visitor updating a photo affects 0 rows'
);

select is_empty(
  $$delete from storage.objects where id = '10000000-0000-4000-8000-000000000001' returning id$$,
  'an anonymous visitor deleting a photo affects 0 rows'
);

-- ---------------------------------------------------------------------------
-- 2. A Seeker
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000001/%'$$,
  $$values ('e0000000-0000-4000-8000-000000000001/hall.jpg')$$,
  'a Seeker lists photos of a verified space'
);

select is_empty(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000002/%'$$,
  'a Seeker gets 0 rows for a pending space''s photos'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('space-photos', 'e0000000-0000-4000-8000-000000000001/seeker.jpg')$$,
  '42501',
  null,
  'a Seeker cannot upload photos'
);

select is_empty(
  $$update storage.objects set name = 'e0000000-0000-4000-8000-000000000001/seeker_rename.jpg' where id = '10000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker updating a Host''s photo affects 0 rows'
);

select is_empty(
  $$delete from storage.objects where id = '10000000-0000-4000-8000-000000000001' returning id$$,
  'a Seeker deleting a Host''s photo affects 0 rows'
);

-- ---------------------------------------------------------------------------
-- 3. Another Host (host2)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select results_eq(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000001/%'$$,
  $$values ('e0000000-0000-4000-8000-000000000001/hall.jpg')$$,
  'another Host lists photos of a verified space'
);

select is_empty(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000002/%'$$,
  'another Host gets 0 rows for a pending space''s photos'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('space-photos', 'e0000000-0000-4000-8000-000000000001/other_host.jpg')$$,
  '42501',
  null,
  'another Host cannot upload photos to a space they do not own'
);

select is_empty(
  $$update storage.objects set name = 'e0000000-0000-4000-8000-000000000001/other_host_rename.jpg' where id = '10000000-0000-4000-8000-000000000001' returning id$$,
  'another Host updating a Host''s photo affects 0 rows'
);

select is_empty(
  $$delete from storage.objects where id = '10000000-0000-4000-8000-000000000001' returning id$$,
  'another Host deleting a Host''s photo affects 0 rows'
);

-- ---------------------------------------------------------------------------
-- 4. Host (host1)
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000001/%'$$,
  $$values ('e0000000-0000-4000-8000-000000000001/hall.jpg')$$,
  'a Host lists photos of their own verified space'
);

select results_eq(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000002/%'$$,
  $$values ('e0000000-0000-4000-8000-000000000002/night.jpg')$$,
  'a Host lists photos of their own pending space'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('space-photos', '00000000-0000-0000-0000-000000000000/nonexistent.jpg')$$,
  '42501',
  null,
  'a Host cannot upload a photo to a non-existent space'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('space-photos', 'root_file.jpg')$$,
  '42501',
  null,
  'a Host cannot upload a photo outside a space folder'
);

select lives_ok(
  $$insert into storage.objects (id, bucket_id, name) values ('10000000-0000-4000-8000-000000000010', 'space-photos', 'e0000000-0000-4000-8000-000000000001/my_upload.jpg')$$,
  'a Host can upload a photo to their own space'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('space-photos', 'e0000000-0000-4000-8000-000000000001/sub/deep.jpg')$$,
  '42501',
  null,
  'a Host cannot upload a photo into a subfolder of their own space''s folder'
);

select results_eq(
  $$update storage.objects set metadata = '{"size": 2}' where id = '10000000-0000-4000-8000-000000000010' returning name$$,
  $$values ('e0000000-0000-4000-8000-000000000001/my_upload.jpg')$$,
  'a Host can replace a photo in their own space (an update that keeps its name)'
);

select results_eq(
  $$update storage.objects set name = 'e0000000-0000-4000-8000-000000000001/my_upload_renamed.jpg' where id = '10000000-0000-4000-8000-000000000010' returning name$$,
  $$values ('e0000000-0000-4000-8000-000000000001/my_upload_renamed.jpg')$$,
  'a Host can rename a photo inside their own space''s folder'
);

select throws_ok(
  $$update storage.objects set name = 'e0000000-0000-4000-8000-000000000001/sub/my_upload_renamed.jpg' where id = '10000000-0000-4000-8000-000000000010'$$,
  '42501',
  null,
  'a Host cannot move their own photo into a subfolder of their own space''s folder'
);

select throws_ok(
  $$update storage.objects set name = 'e0000000-0000-4000-8000-000000000003/my_upload_renamed.jpg' where id = '10000000-0000-4000-8000-000000000010'$$,
  '42501',
  null,
  'a Host moving their own photo into another Host''s Space''s folder is denied by storage RLS'
);

select results_eq(
  $$delete from storage.objects where id = '10000000-0000-4000-8000-000000000010' returning id$$,
  $$values ('10000000-0000-4000-8000-000000000010'::uuid)$$,
  'a Host can delete a photo from their own space'
);

-- ---------------------------------------------------------------------------
-- 5. An Administrator
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select results_eq(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000001/%'$$,
  $$values ('e0000000-0000-4000-8000-000000000001/hall.jpg')$$,
  'an Administrator lists photos of a verified space'
);

select results_eq(
  $$select name from storage.objects where bucket_id = 'space-photos' and name like 'e0000000-0000-4000-8000-000000000002/%'$$,
  $$values ('e0000000-0000-4000-8000-000000000002/night.jpg')$$,
  'an Administrator lists photos of a pending space'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('space-photos', 'e0000000-0000-4000-8000-000000000001/admin.jpg')$$,
  '42501',
  null,
  'an Administrator cannot upload photos to a space they do not own'
);

select is_empty(
  $$update storage.objects set name = 'e0000000-0000-4000-8000-000000000001/admin_rename.jpg' where id = '10000000-0000-4000-8000-000000000001' returning id$$,
  'an Administrator updating a Host''s photo affects 0 rows'
);

select is_empty(
  $$delete from storage.objects where id = '10000000-0000-4000-8000-000000000001' returning id$$,
  'an Administrator deleting a Host''s photo affects 0 rows'
);

select * from finish();
rollback;
