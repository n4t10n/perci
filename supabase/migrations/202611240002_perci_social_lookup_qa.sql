-- Percí v1.16.1: búsqueda exacta por @usuario y correo con opt-in.
-- QA EXCLUSIVAMENTE. Aplicar DESPUÉS de 202611240001_perci_social_qa.sql.
-- NO ejecutar en DEV/producción sin revisión y aprobación de release.
begin;

alter table public.perci_social_profiles add column if not exists username text;
alter table public.perci_social_profiles add column if not exists email_discoverable boolean not null default false;
create unique index if not exists perci_social_username_unique on public.perci_social_profiles (lower(username)) where username is not null;

create table if not exists public.perci_social_search_attempts (
    actor_id uuid not null references auth.users(id) on delete cascade,
    occurred_at timestamptz not null default now()
);
create index if not exists perci_social_search_attempts_actor_idx
    on public.perci_social_search_attempts(actor_id,occurred_at desc);
alter table public.perci_social_search_attempts enable row level security;
revoke all on public.perci_social_search_attempts from public,anon,authenticated;

-- Función interna. Limita intentos, no guarda consultas ni correos buscados.
create or replace function public.perci_social_search_guard()
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid:=auth.uid(); count_recent integer;
begin
    if me is null then raise exception 'Iniciá sesión.'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(me::text)::bigint);
    select count(*) into count_recent from public.perci_social_search_attempts
      where actor_id=me and occurred_at>now()-interval '1 hour';
    if count_recent>=30 then raise exception 'Alcanzaste el límite de búsquedas. Probá más tarde.'; end if;
    insert into public.perci_social_search_attempts(actor_id) values(me);
end $$;
revoke all on function public.perci_social_search_guard() from public,anon,authenticated;

-- Búsqueda exacta del identificador. Email solo si la persona lo habilitó.
create or replace function public.perci_social_match(p_mode text,p_query text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid; value text:=pg_catalog.lower(pg_catalog.btrim(p_query));
begin
    if p_mode not in ('code','username','email') or value is null or char_length(value)>254 then return null; end if;
    if p_mode='code' and value !~ '^[a-f0-9]{16}$' then return null; end if;
    if p_mode='username' and value !~ '^[a-z0-9_]{3,24}$' then return null; end if;
    if p_mode='email' and value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return null; end if;
    select p.user_id into result_id
    from public.perci_social_profiles p
    left join auth.users u on u.id=p.user_id
    where (p_mode='code' and pg_catalog.lower(p.invite_code)=value)
       or (p_mode='username' and pg_catalog.lower(p.username)=value)
       or (p_mode='email' and p.email_discoverable=true and pg_catalog.lower(u.email)=value)
    limit 1;
    return result_id;
end $$;
revoke all on function public.perci_social_match(text,text) from public,anon,authenticated;

create or replace function public.perci_social_settings(p_username text,p_email_discoverable boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid:=auth.uid(); saved_name text;
begin
    if me is null then raise exception 'Iniciá sesión.'; end if;
    p_username:=pg_catalog.lower(pg_catalog.btrim(p_username));
    if p_username is null or p_username !~ '^[a-z0-9_]{3,24}$' then
      raise exception 'Usá de 3 a 24 letras, números o guion bajo.';
    end if;
    if p_email_discoverable is null then raise exception 'Preferencia de privacidad inválida.'; end if;
    update public.perci_social_profiles set username=p_username,email_discoverable=p_email_discoverable
      where user_id=me returning username into saved_name;
    if saved_name is null then raise exception 'Activá primero tu perfil social.'; end if;
    return jsonb_build_object('saved',true,'username',saved_name);
exception when unique_violation then
    raise exception 'Ese nombre de usuario ya está ocupado.';
end $$;

create or replace function public.perci_social_find(p_mode text,p_query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid:=auth.uid(); target uuid; found_name text; found_user text;
begin
    if me is null then raise exception 'Iniciá sesión.'; end if;
    if not exists(select 1 from public.perci_social_profiles where user_id=me) then
      raise exception 'Activá primero tu perfil social.';
    end if;
    perform public.perci_social_search_guard();
    target:=public.perci_social_match(p_mode,p_query);
    if target is null or target=me then return jsonb_build_object('found',false); end if;
    select display_name,username into found_name,found_user
      from public.perci_social_profiles where user_id=target;
    return jsonb_build_object('found',true,'name',found_name,'username',found_user);
end $$;

create or replace function public.perci_social_invite_lookup(p_mode text,p_query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid:=auth.uid(); target uuid; target_code text; outcome jsonb;
begin
    if me is null then raise exception 'Iniciá sesión.'; end if;
    perform public.perci_social_search_guard();
    target:=public.perci_social_match(p_mode,p_query);
    if target is null or target=me then return jsonb_build_object('sent',false); end if;
    select invite_code into target_code from public.perci_social_profiles where user_id=target;
    -- Bloque anidado: conserva el intento de búsqueda aun cuando la invitación falle.
    begin
      outcome:=public.perci_social_invite(target_code);
    exception when others then
      return jsonb_build_object('sent',false);
    end;
    return outcome;
end $$;

-- Mantener el RPC existente; sumar únicamente campos explícitos del perfil propio.
create or replace function public.perci_social_overview()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); profile_json jsonb; friends_json jsonb; received_json jsonb; sent_json jsonb;
begin
  if me is null then raise exception 'Iniciá sesión.'; end if;
  select jsonb_build_object('code',p.invite_code,'name',p.display_name,
                            'username',p.username,'emailDiscoverable',p.email_discoverable)
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

revoke all on function public.perci_social_settings(text,boolean) from public,anon,authenticated;
revoke all on function public.perci_social_find(text,text) from public,anon,authenticated;
revoke all on function public.perci_social_invite_lookup(text,text) from public,anon,authenticated;
grant execute on function public.perci_social_settings(text,boolean) to authenticated;
grant execute on function public.perci_social_find(text,text) to authenticated;
grant execute on function public.perci_social_invite_lookup(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
