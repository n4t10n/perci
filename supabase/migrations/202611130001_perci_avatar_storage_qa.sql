-- Percí v1.13.0 · Apply ONLY to the isolated Supabase QA project.
-- No public assets, no service_role, no changes to workout data tables.
-- Supabase Storage bucket is PRIVATE. Each JWT only accesses its own UUID path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perci-avatars-qa', 'perci-avatars-qa', false, 200000, array['image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Fixed key per user: <auth.uid()>/avatar.webp, no nested or arbitrary filenames.
drop policy if exists "perci_avatar_read_own" on storage.objects;
create policy "perci_avatar_read_own" on storage.objects
for select to authenticated using (
  bucket_id = 'perci-avatars-qa'
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists "perci_avatar_create_own" on storage.objects;
create policy "perci_avatar_create_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'perci-avatars-qa'
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists "perci_avatar_replace_own" on storage.objects;
create policy "perci_avatar_replace_own" on storage.objects
for update to authenticated using (
  bucket_id = 'perci-avatars-qa'
  and name = (select auth.uid())::text || '/avatar.webp'
) with check (
  bucket_id = 'perci-avatars-qa'
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists "perci_avatar_remove_own" on storage.objects;
create policy "perci_avatar_remove_own" on storage.objects
for delete to authenticated using (
  bucket_id = 'perci-avatars-qa'
  and name = (select auth.uid())::text || '/avatar.webp'
);
