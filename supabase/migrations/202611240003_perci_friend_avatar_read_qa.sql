-- Percí v1.16.2. Ejecutar EXCLUSIVAMENTE en Supabase QA vafurtauwarukdcopjnh.
-- Aplicar DESPUÉS de migraciones 202611240001 y 202611240002.
-- Mantiene el bucket perci-avatars-qa PRIVADO. Solo amistades aceptadas.
-- No copia, borra ni publica fotos. No modifica datos de entrenamiento.
begin;

-- Fallar explícitamente si no se aplicó la migración histórica de avatares QA.
do $$ begin
  if not exists(select 1 from storage.buckets where id='perci-avatars-qa') then
    raise exception 'Falta el bucket perci-avatars-qa: aplicá las migraciones de avatares QA antes de continuar.';
  end if;
end $$;

-- Busca el dueño de una foto únicamente mediante un ID de amistad aceptada.
create or replace function public.perci_social_avatar_owner(p_friendship_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid:=auth.uid(); owner_id uuid;
begin
  if me is null then raise exception 'Iniciá sesión.'; end if;
  select case when f.requester_id=me then f.recipient_id else f.requester_id end
    into owner_id from public.perci_friendships f
    where f.id=p_friendship_id and f.status='accepted'
      and (f.requester_id=me or f.recipient_id=me);
  return owner_id;
end $$;
revoke all on function public.perci_social_avatar_owner(uuid) from public,anon;
grant execute on function public.perci_social_avatar_owner(uuid) to authenticated;

-- Regla de Storage: el JWT del visitante debe pertenecer a una amistad aceptada
-- con el propietario. Valida el path exacto; no permite listar otros buckets.
create or replace function public.perci_social_friend_avatar_allowed(p_path text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare me uuid:=auth.uid(); target uuid;
begin
  if me is null or p_path is null or
     p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.(jpg|webp)$'
  then return false; end if;
  target:=pg_catalog.split_part(p_path,'/',1)::uuid;
  if target=me then return false; end if;
  return exists (
    select 1 from public.perci_friendships f where f.status='accepted'
      and ((f.requester_id=me and f.recipient_id=target)
        or (f.recipient_id=me and f.requester_id=target))
  );
end $$;
revoke all on function public.perci_social_friend_avatar_allowed(text) from public,anon;
grant execute on function public.perci_social_friend_avatar_allowed(text) to authenticated;

drop policy if exists "perci_avatar_friend_read_qa" on storage.objects;
create policy "perci_avatar_friend_read_qa" on storage.objects
for select to authenticated using (
  bucket_id='perci-avatars-qa' and
  public.perci_social_friend_avatar_allowed(name)
);

-- Verificación de privacidad: jamás habilitamos bucket público.
update storage.buckets set public=false where id='perci-avatars-qa';
notify pgrst, 'reload schema';
commit;
