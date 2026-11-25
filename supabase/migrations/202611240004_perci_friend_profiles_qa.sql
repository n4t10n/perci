-- Percí v1.17.0. SOLO Supabase QA: vafurtauwarukdcopjnh.
-- Ejecutar DESPUÉS de las migraciones Social 001, 002 y 003.
-- Rutinas privadas por defecto. Solo se comparten plantillas consentidas con AMISTADES ACEPTADAS.
-- No publica historiales, pesos registrados, métricas, hábitos ni el correo del usuario.
begin;

alter table public.perci_social_profiles
  add column if not exists bio text not null default '' check (char_length(bio)<=160);

create table if not exists public.perci_social_routines (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null check (char_length(source_id) between 1 and 120),
  payload jsonb not null,
  published_at timestamptz not null default now(),
  primary key(user_id,source_id)
);
create index if not exists perci_social_routines_user_idx on public.perci_social_routines(user_id);
alter table public.perci_social_routines enable row level security;
revoke all on public.perci_social_routines from public,anon,authenticated;

-- Únicamente el titular actualiza su presentación.
create or replace function public.perci_social_update_bio(p_bio text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); updated_id uuid;
begin
 if me is null then raise exception 'Iniciá sesión.'; end if;
 if p_bio is null or char_length(btrim(p_bio))>160 then raise exception 'Presentación inválida.'; end if;
 update public.perci_social_profiles set bio=btrim(p_bio)
 where user_id=me returning user_id into updated_id;
 if updated_id is null then raise exception 'Activá primero tu perfil social.'; end if;
 return jsonb_build_object('saved',true);
end $$;

-- Solo acepta plantillas de rutinas con campos name, exercises[{name,sets,reps}].
-- El cliente Python filtra la información, y SQL vuelve a validarla y limpiarla
-- para evitar que una llamada REST directa pueda subir historiales o datos privados.
create or replace function public.perci_social_publish_routine(p_source_id text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 me uuid:=auth.uid(); routine_name text; item jsonb; item_name text;
 number_sets integer; number_reps integer; clean_exercises jsonb:='[]'::jsonb;
begin
 if me is null then raise exception 'Iniciá sesión.'; end if;
 if not exists(select 1 from public.perci_social_profiles where user_id=me) then
   raise exception 'Activá primero tu perfil social.';
 end if;
 if p_source_id is null or char_length(p_source_id)<1 or char_length(p_source_id)>120 then
   raise exception 'Identificador de rutina inválido.';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'name') is distinct from 'string'
    or jsonb_typeof(p_payload->'exercises') is distinct from 'array' then
   raise exception 'Plantilla inválida.';
 end if;
 routine_name:=btrim(p_payload->>'name');
 if char_length(routine_name)<1 or char_length(routine_name)>80 or
    jsonb_array_length(p_payload->'exercises') not between 1 and 40 then
   raise exception 'La rutina debe tener un nombre y entre 1 y 40 ejercicios.';
 end if;
 for item in select value from jsonb_array_elements(p_payload->'exercises') loop
   if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'name') is distinct from 'string' or
      jsonb_typeof(item->'sets') is distinct from 'number' or jsonb_typeof(item->'reps') is distinct from 'number' then
      raise exception 'Ejercicio inválido.';
   end if;
   item_name:=btrim(item->>'name');
   if char_length(item_name)<1 or char_length(item_name)>80 or
      char_length(item->>'sets')>3 or char_length(item->>'reps')>3 or
      (item->>'sets') !~ '^[0-9]+$' or (item->>'reps') !~ '^[0-9]+$' then
      raise exception 'Ejercicio inválido.';
   end if;
   number_sets:=(item->>'sets')::integer;
   number_reps:=(item->>'reps')::integer;
   if number_sets not between 1 and 15 or number_reps not between 1 and 100 then
      raise exception 'Series o repeticiones inválidas.';
   end if;
   clean_exercises:=clean_exercises || jsonb_build_array(
      jsonb_build_object('name',item_name,'sets',number_sets,'reps',number_reps));
 end loop;
 if not exists(select 1 from public.perci_social_routines where user_id=me and source_id=p_source_id) and
    (select count(*) from public.perci_social_routines where user_id=me)>=30 then
      raise exception 'Podés mostrar hasta 30 rutinas en tu perfil.';
 end if;
 insert into public.perci_social_routines(user_id,source_id,payload)
 values(me,p_source_id,jsonb_build_object('name',routine_name,'exercises',clean_exercises))
 on conflict(user_id,source_id) do update
 set payload=excluded.payload,published_at=now();
 return jsonb_build_object('published',true);
end $$;

create or replace function public.perci_social_unpublish_routine(p_source_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid:=auth.uid();
begin
 if me is null then raise exception 'Iniciá sesión.'; end if;
 if p_source_id is null or char_length(p_source_id)<1 or char_length(p_source_id)>120 then
    raise exception 'Identificador inválido.'; end if;
 delete from public.perci_social_routines where user_id=me and source_id=p_source_id;
 return jsonb_build_object('hidden',true);
end $$;

-- Perfil propio con lista de publicaciones, sin acceso al historial privado.
create or replace function public.perci_social_my_profile()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid:=auth.uid(); profile_json jsonb; routines_json jsonb;
begin
 if me is null then raise exception 'Iniciá sesión.'; end if;
 select jsonb_build_object('name',p.display_name,'username',p.username,'bio',p.bio)
 into profile_json from public.perci_social_profiles p where p.user_id=me;
 if profile_json is null then raise exception 'Activá primero tu perfil social.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'sourceId',r.source_id,'name',r.payload->>'name',
   'exercises',r.payload->'exercises','publishedAt',r.published_at)
   order by r.published_at desc),'[]'::jsonb)
 into routines_json from public.perci_social_routines r where r.user_id=me;
 return jsonb_build_object('profile',profile_json,'routines',routines_json);
end $$;

-- Solo el otro participante de una amistad ACEPTADA puede ver el perfil y sus
-- publicaciones. No expone IDs de usuario, emails, entrenamientos ni pesos.
create or replace function public.perci_social_friend_profile(p_friendship_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid:=auth.uid(); friend_id uuid; profile_json jsonb; routines_json jsonb;
begin
 if me is null then raise exception 'Iniciá sesión.'; end if;
 select case when f.requester_id=me then f.recipient_id else f.requester_id end
 into friend_id from public.perci_friendships f
 where f.id=p_friendship_id and f.status='accepted'
   and (f.requester_id=me or f.recipient_id=me);
 if friend_id is null then raise exception 'Perfil no disponible.'; end if;
 select jsonb_build_object('name',p.display_name,'username',p.username,'bio',p.bio)
 into profile_json from public.perci_social_profiles p where p.user_id=friend_id;
 if profile_json is null then raise exception 'Perfil no disponible.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'sourceId',r.source_id,'name',r.payload->>'name',
   'exercises',r.payload->'exercises','publishedAt',r.published_at)
   order by r.published_at desc),'[]'::jsonb)
 into routines_json from public.perci_social_routines r where r.user_id=friend_id;
 return jsonb_build_object('profile',profile_json,'routines',routines_json);
end $$;

revoke all on function public.perci_social_update_bio(text) from public,anon;
revoke all on function public.perci_social_publish_routine(text,jsonb) from public,anon;
revoke all on function public.perci_social_unpublish_routine(text) from public,anon;
revoke all on function public.perci_social_my_profile() from public,anon;
revoke all on function public.perci_social_friend_profile(uuid) from public,anon;
grant execute on function public.perci_social_update_bio(text) to authenticated;
grant execute on function public.perci_social_publish_routine(text,jsonb) to authenticated;
grant execute on function public.perci_social_unpublish_routine(text) to authenticated;
grant execute on function public.perci_social_my_profile() to authenticated;
grant execute on function public.perci_social_friend_profile(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
