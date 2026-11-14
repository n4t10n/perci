-- Percí DEV v1.13.1. Ejecutar SOLO en el proyecto Supabase DEV correcto.
-- Esta migración NO afecta datos de entrenamiento ni bucket QA.
-- Antes de ejecutarla: validar SUPABASE_URL del proyecto DEV en Vercel.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perci-avatars-dev', 'perci-avatars-dev', false, 200000, array['image/webp','image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Claves admitidas por UID: <auth.uid()>/avatar.jpg y <auth.uid()>/avatar.webp.
-- Políticas DEV con nombres propios; no borran ninguna política de QA.
drop policy if exists "perci_avatar_dev_read_own" on storage.objects;
create policy "perci_avatar_dev_read_own" on storage.objects
for select to authenticated using (
  bucket_id = 'perci-avatars-dev'
  and name in ((select auth.uid())::text || '/avatar.jpg',
               (select auth.uid())::text || '/avatar.webp')
);
drop policy if exists "perci_avatar_dev_create_own" on storage.objects;
create policy "perci_avatar_dev_create_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'perci-avatars-dev'
  and name in ((select auth.uid())::text || '/avatar.jpg',
               (select auth.uid())::text || '/avatar.webp')
);
drop policy if exists "perci_avatar_dev_replace_own" on storage.objects;
create policy "perci_avatar_dev_replace_own" on storage.objects
for update to authenticated using (
  bucket_id = 'perci-avatars-dev'
  and name in ((select auth.uid())::text || '/avatar.jpg',
               (select auth.uid())::text || '/avatar.webp')
) with check (
  bucket_id = 'perci-avatars-dev'
  and name in ((select auth.uid())::text || '/avatar.jpg',
               (select auth.uid())::text || '/avatar.webp')
);
drop policy if exists "perci_avatar_dev_remove_own" on storage.objects;
create policy "perci_avatar_dev_remove_own" on storage.objects
for delete to authenticated using (
  bucket_id = 'perci-avatars-dev'
  and name in ((select auth.uid())::text || '/avatar.jpg',
               (select auth.uid())::text || '/avatar.webp')
);
commit;
