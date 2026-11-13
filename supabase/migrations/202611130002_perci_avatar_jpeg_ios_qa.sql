-- Percí QA v1.13.1: Safari JPEG, backward-compatible with earlier private WebP.
-- Apply ONLY in Supabase QA. Re-run safe; no public access or workout changes.
begin;
update storage.buckets
set public = false,
    file_size_limit = 200000,
    allowed_mime_types = array['image/webp','image/jpeg']
where id = 'perci-avatars-qa';

-- Both exact keys per authenticated UID; no arbitrary filenames or sharing.
drop policy if exists "perci_avatar_read_own" on storage.objects;
create policy "perci_avatar_read_own" on storage.objects
for select to authenticated using (
  bucket_id = 'perci-avatars-qa'
  and name in ((select auth.uid())::text || '/avatar.webp',
               (select auth.uid())::text || '/avatar.jpg')
);
drop policy if exists "perci_avatar_create_own" on storage.objects;
create policy "perci_avatar_create_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'perci-avatars-qa'
  and name in ((select auth.uid())::text || '/avatar.webp',
               (select auth.uid())::text || '/avatar.jpg')
);
drop policy if exists "perci_avatar_replace_own" on storage.objects;
create policy "perci_avatar_replace_own" on storage.objects
for update to authenticated using (
  bucket_id = 'perci-avatars-qa'
  and name in ((select auth.uid())::text || '/avatar.webp',
               (select auth.uid())::text || '/avatar.jpg')
) with check (
  bucket_id = 'perci-avatars-qa'
  and name in ((select auth.uid())::text || '/avatar.webp',
               (select auth.uid())::text || '/avatar.jpg')
);
drop policy if exists "perci_avatar_remove_own" on storage.objects;
create policy "perci_avatar_remove_own" on storage.objects
for delete to authenticated using (
  bucket_id = 'perci-avatars-qa'
  and name in ((select auth.uid())::text || '/avatar.webp',
               (select auth.uid())::text || '/avatar.jpg')
);
commit;
