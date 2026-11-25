-- PERCI SOCIAL v1.16.0 QA - Ejecutar EXCLUSIVAMENTE en Supabase QA.
-- No aplicar en el Supabase compartido por DEV y producción antes de validar.
-- No copia ni publica históricos, emails, peso, rutinas o fotografías.
begin;

create table if not exists public.perci_social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invite_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  created_at timestamptz not null default now()
);
create table if not exists public.perci_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> recipient_id)
);
create unique index if not exists perci_friendships_pair_unique
  on public.perci_friendships (least(requester_id,recipient_id),greatest(requester_id,recipient_id));
create index if not exists perci_friendships_recipient_idx on public.perci_friendships (recipient_id,status);
create index if not exists perci_friendships_requester_idx on public.perci_friendships (requester_id,status);

alter table public.perci_social_profiles enable row level security;
alter table public.perci_friendships enable row level security;
revoke all on public.perci_social_profiles,public.perci_friendships from public,anon,authenticated;
-- Sin GRANT de tablas ni políticas de lectura: todo pasa por RPC autenticadas y acotadas.

create or replace function public.perci_social_setup(p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); result_code text; result_name text;
begin
  if me is null then raise exception 'Iniciá sesión.'; end if;
  p_name := btrim(p_name);
  if p_name is null or char_length(p_name) < 2 or char_length(p_name) > 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres.';
  end if;
  insert into public.perci_social_profiles(user_id,display_name) values(me,p_name)
  on conflict(user_id) do update set display_name=excluded.display_name
  returning invite_code,display_name into result_code,result_name;
  return jsonb_build_object('code',result_code,'name',result_name);
end $$;

create or replace function public.perci_social_overview()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); profile_json jsonb; friends_json jsonb; received_json jsonb; sent_json jsonb;
begin
  if me is null then raise exception 'Iniciá sesión.'; end if;
  select jsonb_build_object('code',p.invite_code,'name',p.display_name)
    into profile_json from public.perci_social_profiles p where p.user_id=me;
  select coalesce(jsonb_agg(t.item),'[]'::jsonb) into friends_json from (
    select jsonb_build_object('requestId',f.id,'name',p.display_name) as item
    from public.perci_friendships f
    join public.perci_social_profiles p on p.user_id=case when f.requester_id=me then f.recipient_id else f.requester_id end
    where f.status='accepted' and (f.requester_id=me or f.recipient_id=me)
    order by f.created_at desc limit 100
  ) t;
  select coalesce(jsonb_agg(t.item),'[]'::jsonb) into received_json from (
    select jsonb_build_object('requestId',f.id,'name',p.display_name) as item
    from public.perci_friendships f join public.perci_social_profiles p on p.user_id=f.requester_id
    where f.status='pending' and f.recipient_id=me
    order by f.created_at desc limit 100
  ) t;
  select coalesce(jsonb_agg(t.item),'[]'::jsonb) into sent_json from (
    select jsonb_build_object('requestId',f.id,'name',p.display_name) as item
    from public.perci_friendships f join public.perci_social_profiles p on p.user_id=f.recipient_id
    where f.status='pending' and f.requester_id=me
    order by f.created_at desc limit 100
  ) t;
  return jsonb_build_object('profile',profile_json,'friends',friends_json,'received',received_json,'sent',sent_json);
end $$;

create or replace function public.perci_social_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); target uuid; new_id uuid; existing_id uuid;
begin
  if me is null then raise exception 'Iniciá sesión.'; end if;
  if p_code is null or p_code !~ '^[A-F0-9]{16}$' then raise exception 'Código inválido.'; end if;
  if not exists(select 1 from public.perci_social_profiles where user_id=me) then
    raise exception 'Activá tu perfil social primero.';
  end if;
  select user_id into target from public.perci_social_profiles where invite_code=p_code;
  if target is null or target=me then raise exception 'No encontramos otro usuario con ese código.'; end if;
  if (select count(*) from public.perci_friendships where requester_id=me and status='pending')>=30 then
    raise exception 'Demasiadas solicitudes pendientes.';
  end if;
  select id into existing_id from public.perci_friendships
    where least(requester_id,recipient_id)=least(me,target)
      and greatest(requester_id,recipient_id)=greatest(me,target);
  if existing_id is not null then raise exception 'Ya existe una solicitud o amistad con ese usuario.'; end if;
  insert into public.perci_friendships(requester_id,recipient_id)
    values(me,target) on conflict do nothing returning id into new_id;
  if new_id is null then raise exception 'La solicitud ya existe.'; end if;
  return jsonb_build_object('sent',true);
end $$;

create or replace function public.perci_social_accept(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); updated_id uuid;
begin
  if me is null then raise exception 'Iniciá sesión.'; end if;
  update public.perci_friendships set status='accepted',accepted_at=now()
    where id=p_request_id and recipient_id=me and status='pending'
    returning id into updated_id;
  if updated_id is null then raise exception 'Solicitud no disponible.'; end if;
  return jsonb_build_object('accepted',true);
end $$;

create or replace function public.perci_social_remove(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); deleted_id uuid;
begin
  if me is null then raise exception 'Iniciá sesión.'; end if;
  delete from public.perci_friendships where id=p_request_id and (requester_id=me or recipient_id=me)
    returning id into deleted_id;
  if deleted_id is null then raise exception 'Solicitud o amistad no disponible.'; end if;
  return jsonb_build_object('removed',true);
end $$;

revoke all on function public.perci_social_setup(text) from public,anon;
revoke all on function public.perci_social_overview() from public,anon;
revoke all on function public.perci_social_invite(text) from public,anon;
revoke all on function public.perci_social_accept(uuid) from public,anon;
revoke all on function public.perci_social_remove(uuid) from public,anon;
grant execute on function public.perci_social_setup(text) to authenticated;
grant execute on function public.perci_social_overview() to authenticated;
grant execute on function public.perci_social_invite(text) to authenticated;
grant execute on function public.perci_social_accept(uuid) to authenticated;
grant execute on function public.perci_social_remove(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
