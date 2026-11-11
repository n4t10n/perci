-- PERCÍ 1.7.6 | DEV ATOMIC SYNC | DRAFT FOR REVIEW ONLY
-- NO EJECUTAR TODAVÍA. No se aplicó SQL ni se modificó Supabase DEV.
-- Esta migración es ADITIVA: crea RPC, tabla de revisiones y esquema privado.
-- NO revoca los escritores legacy. La activación requiere un cutover separado.
-- Sin backup restaurable, la reversión de datos NO está garantizada.
-- Definiciones de funciones copiadas textualmente de export SQL Supabase QA.
-- QA PUBLIC SHA256:  f0f9a7f6c975b86fb998a5b5f4150facf5eb9a567a35296b8bbab68f59fa4f9d
-- QA PRIVATE SHA256: b9c12b5c5f5ce8bd30a31ab08942bee4d91eebfd48b50574b15c179ac7112769
-- Las definiciones exportadas NO contienen GRANTS, tabla ni política RLS;
-- esas piezas se incluyen según el esquema previamente auditado.
-- Leer y auditar antes de autorizar cualquier ejecución.
-- Ejecutar exclusivamente en Supabase DEV, desde SQL Editor con rol admin.
-- NO ejecutar en perci-qa. NO ejecutar en ninguna otra base.
-- Confirmar que perci_private NO esté en Data API > Exposed schemas.

BEGIN;

-- Fail closed si el entorno no tiene el esquema base o si el atomic layer
-- existe ya total o parcialmente; evita pisar una instalación inesperada.
DO $guard$
BEGIN
  IF to_regclass('public.perci_profiles') IS NULL
     OR to_regclass('public.perci_routines') IS NULL
     OR to_regclass('public.perci_routine_exercises') IS NULL
     OR to_regclass('public.perci_activity_records') IS NULL
     OR to_regclass('public.perci_workout_sets') IS NULL
     OR to_regclass('public.perci_habits') IS NULL
     OR to_regclass('public.perci_habit_checks') IS NULL
     OR to_regclass('public.perci_workout_drafts') IS NULL
     OR to_regclass('public.perci_routine_shares') IS NULL
  THEN
    RAISE EXCEPTION 'STOP: esquema Perci DEV incompleto';
  END IF;
  IF to_regclass('public.perci_sync_state') IS NOT NULL
     OR to_regprocedure('public.perci_commit_snapshot(bigint,jsonb,jsonb)') IS NOT NULL
     OR to_regprocedure('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'STOP: sincronización atómica instalada o parcialmente instalada';
  END IF;
END
$guard$;

CREATE SCHEMA IF NOT EXISTS perci_private;
REVOKE ALL ON SCHEMA perci_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA perci_private TO authenticated;

CREATE TABLE public.perci_sync_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.perci_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.perci_sync_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.perci_sync_state TO authenticated;
CREATE POLICY perci_sync_state_read_own ON public.perci_sync_state
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Función exacta de Supabase QA; privilegios SECURITY DEFINER.
CREATE OR REPLACE FUNCTION perci_private.perci_commit_snapshot_impl(p_expected_revision bigint, p_snapshot jsonb, p_deletions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_revision bigint;
  v_item jsonb;
  v_child jsonb;
  v_key text;
  v_done jsonb;
  v_match text[];
  v_kind text;
  v_delete_id text;
  v_routine_id uuid;
  v_record_id uuid;
  v_habit_id uuid;
  v_habit_ids uuid[] := '{}'::uuid[];
  v_pos integer;
  v_deleted_count integer := 0;
  v_demo boolean := false;
begin
  if v_user is null then
    raise sqlstate 'PT401' using message='Iniciá sesión antes de sincronizar.';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise sqlstate 'PT400' using message='Revisión remota inválida.';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
    or jsonb_typeof(p_snapshot->'routines') <> 'array'
    or jsonb_typeof(p_snapshot->'records') <> 'array'
    or jsonb_typeof(p_snapshot->'habits') <> 'array'
    or jsonb_typeof(coalesce(p_snapshot->'checks', '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_deletions, '{}'::jsonb)) <> 'object'
    or (p_snapshot ? 'draft' and p_snapshot->'draft' <> 'null'::jsonb)
    or octet_length(p_snapshot::text) > 1000000 then
    raise sqlstate 'PT400' using message='Snapshot inválido o entrenamiento sin finalizar.';
  end if;
  if jsonb_array_length(p_snapshot->'routines') > 300
    or jsonb_array_length(p_snapshot->'records') > 300
    or jsonb_array_length(p_snapshot->'habits') > 300 then
    raise sqlstate 'PT400' using message='Demasiados elementos en snapshot.';
  end if;
  for v_kind in select key from jsonb_each(coalesce(p_deletions, '{}'::jsonb)) loop
    if v_kind not in ('routines','records','habits')
      or jsonb_typeof(p_deletions->v_kind) <> 'array'
      or jsonb_array_length(p_deletions->v_kind) > 100 then
      raise sqlstate 'PT400' using message='Eliminaciones inválidas.';
    end if;
    v_deleted_count := v_deleted_count + jsonb_array_length(p_deletions->v_kind);
  end loop;
  if v_deleted_count > 100 then
    raise sqlstate 'PT400' using message='Demasiadas eliminaciones.';
  end if;

  -- El primer escritor crea la fila, los demás esperan el candado.
  -- Esta operación se ejecuta con privilegios de la función, pero su cuenta
  -- se obtiene exclusivamente desde auth.uid() y todas las consultas usan v_user.
  -- Toda la función es UNA transacción PostgreSQL bajo PostgREST /rpc.
  insert into public.perci_sync_state(user_id, revision)
    values (v_user, 0) on conflict (user_id) do nothing;
  select revision into v_revision from public.perci_sync_state
    where user_id=v_user for update;
  if v_revision is distinct from p_expected_revision then
    raise sqlstate 'PT409' using message='Otro dispositivo actualizó la cuenta. Reconciliá antes de reintentar.';
  end if;
  v_demo := coalesce((p_snapshot->>'demo')::boolean, false);

  insert into public.perci_profiles (user_id, theme, focus, onboarding_done)
  values (
    v_user,
    case when p_snapshot->>'theme' in ('dark','light','system') then p_snapshot->>'theme' else 'dark' end,
    case when p_snapshot->>'focus' in ('gym','others','both') then p_snapshot->>'focus' else 'both' end,
    coalesce((p_snapshot->>'onboardSeen') = 'true', false)
  ) on conflict (user_id) do update set
      theme=excluded.theme, focus=excluded.focus,
      onboarding_done=public.perci_profiles.onboarding_done or excluded.onboarding_done;

  -- Rutinas completas. Al editar una rutina se reemplazan sus ejercicios.
  for v_item in select value from jsonb_array_elements(p_snapshot->'routines') loop
    if v_demo and v_item->>'id' = 'r1' then continue; end if;
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$'
      or jsonb_typeof(v_item->'exercises') <> 'array'
      or jsonb_array_length(v_item->'exercises') > 100 then
      raise sqlstate 'PT400' using message='Rutina inválida.';
    end if;
    insert into public.perci_routines (user_id,client_id,name)
      values (v_user,'perci-v04:routine:'||(v_item->>'id'),btrim(v_item->>'name'))
      on conflict (user_id,client_id) do update set name=excluded.name
      returning id into v_routine_id;
    delete from public.perci_routine_exercises
      where user_id=v_user and routine_id=v_routine_id;
    v_pos := 0;
    for v_child in select value from jsonb_array_elements(v_item->'exercises') loop
      if jsonb_typeof(v_child) <> 'object' then
        raise sqlstate 'PT400' using message='Ejercicio inválido.';
      end if;
      insert into public.perci_routine_exercises
        (user_id,routine_id,client_id,position,name,target_sets,target_reps)
      values (
        v_user,v_routine_id,
        'perci-v04:exercise:'||(v_item->>'id')||':'||v_pos::text,
        v_pos,btrim(v_child->>'name'),
        (v_child->>'sets')::integer,(v_child->>'reps')::integer
      );
      v_pos := v_pos + 1;
    end loop;
  end loop;

  -- Actividades y sus series. El reemplazo de series es transaccional.
  for v_item in select value from jsonb_array_elements(p_snapshot->'records') loop
    if v_demo and v_item->>'id' in ('s1','s2','s3') then continue; end if;
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$'
      or jsonb_typeof(coalesce(v_item->'setDetails','[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(v_item->'setDetails','[]'::jsonb)) > 600 then
      raise sqlstate 'PT400' using message='Actividad inválida.';
    end if;
    insert into public.perci_activity_records
      (user_id,client_id,activity_type,name,activity_date,minutes,distance_km,sets_done,volume_kg,note)
    values (
      v_user,'perci-v04:record:'||(v_item->>'id'),v_item->>'type',
      left(v_item->>'name',80),(v_item->>'date')::date,
      (v_item->>'minutes')::integer,(v_item->>'distance')::numeric,
      (v_item->>'setsDone')::integer,(v_item->>'volume')::numeric,
      left(coalesce(v_item->>'note',''),400)
    ) on conflict (user_id,client_id) do update set
      activity_type=excluded.activity_type,name=excluded.name,
      activity_date=excluded.activity_date,minutes=excluded.minutes,
      distance_km=excluded.distance_km,sets_done=excluded.sets_done,
      volume_kg=excluded.volume_kg,note=excluded.note
    returning id into v_record_id;
    delete from public.perci_workout_sets where user_id=v_user and record_id=v_record_id;
    for v_child in select value from jsonb_array_elements(coalesce(v_item->'setDetails','[]'::jsonb)) loop
      insert into public.perci_workout_sets
        (user_id,record_id,exercise_position,exercise_name,set_number,reps,weight_kg,completed)
      values (
        v_user,v_record_id,(v_child->>'exercisePosition')::integer,
        btrim(v_child->>'exerciseName'),(v_child->>'setNumber')::integer,
        (v_child->>'reps')::integer,(v_child->>'weight')::numeric,
        coalesce((v_child->>'completed')::boolean,true)
      );
    end loop;
  end loop;

  -- Hábitos y checks. Un check desmarcado desaparece de la tabla.
  for v_item in select value from jsonb_array_elements(p_snapshot->'habits') loop
    if v_demo and v_item->>'id' in ('h1','h2') then continue; end if;
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$'
      or jsonb_typeof(v_item->'days') <> 'array' then
      raise sqlstate 'PT400' using message='Hábito inválido.';
    end if;
    insert into public.perci_habits (user_id,client_id,name,days,paused)
    values (
      v_user,'perci-v04:habit:'||(v_item->>'id'),left(v_item->>'name',70),
      array(select val::integer from jsonb_array_elements_text(v_item->'days') as t(val)),
      coalesce((v_item->>'paused')::boolean,false)
    ) on conflict (user_id,client_id) do update set
      name=excluded.name, days=excluded.days, paused=excluded.paused
    returning id into v_habit_id;
    v_habit_ids := array_append(v_habit_ids,v_habit_id);
  end loop;

  delete from public.perci_habit_checks
    where user_id=v_user and habit_id = any(v_habit_ids);
  for v_key,v_done in select key,value from jsonb_each(coalesce(p_snapshot->'checks','{}'::jsonb)) loop
    if v_done is distinct from 'true'::jsonb then continue; end if;
    v_match := regexp_match(v_key,'^([a-zA-Z0-9_-]{1,80}):([0-9]{4}-[0-9]{2}-[0-9]{2})$');
    if v_match is null then continue; end if;
    select id into v_habit_id from public.perci_habits
      where user_id=v_user and client_id='perci-v04:habit:'||v_match[1];
    if v_habit_id is null or not (v_habit_id = any(v_habit_ids)) then continue; end if;
    insert into public.perci_habit_checks (user_id,habit_id,check_date,completed)
      values (v_user,v_habit_id,v_match[2]::date,true)
      on conflict (user_id,habit_id,check_date) do update set completed=true;
  end loop;

  -- Borrados explícitos del mismo commit (sin segundo request HTTP).
  for v_kind in select key from jsonb_each(coalesce(p_deletions,'{}'::jsonb)) loop
    for v_child in select value from jsonb_array_elements(p_deletions->v_kind) loop
      if jsonb_typeof(v_child) <> 'string' then
        raise sqlstate 'PT400' using message='ID de eliminación inválido.';
      end if;
      v_delete_id := trim(both '"' from v_child::text);
      if v_delete_id !~ '^[a-zA-Z0-9_-]{1,80}$' then
        raise sqlstate 'PT400' using message='ID de eliminación inválido.';
      end if;
      if v_kind='routines' then
        delete from public.perci_routines where user_id=v_user
          and client_id='perci-v04:routine:'||v_delete_id;
      elsif v_kind='records' then
        delete from public.perci_activity_records where user_id=v_user
          and client_id='perci-v04:record:'||v_delete_id;
      elsif v_kind='habits' then
        delete from public.perci_habits where user_id=v_user
          and client_id='perci-v04:habit:'||v_delete_id;
      end if;
    end loop;
  end loop;

  update public.perci_sync_state
    set revision=revision+1, updated_at=now()
    where user_id=v_user;
  return jsonb_build_object('revision',v_revision+1,
    'routines',jsonb_array_length(p_snapshot->'routines'),
    'records',jsonb_array_length(p_snapshot->'records'),
    'habits',jsonb_array_length(p_snapshot->'habits'));
end;
$function$;

-- Wrapper público exacto de QA (SECURITY INVOKER es el default de PostgreSQL).
CREATE OR REPLACE FUNCTION public.perci_commit_snapshot(p_expected_revision bigint, p_snapshot jsonb, p_deletions jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select perci_private.perci_commit_snapshot_impl(
    p_expected_revision, p_snapshot, p_deletions
  );
$function$;

-- Protección de ejecución del motor privado y wrapper público.
REVOKE ALL ON FUNCTION perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.perci_commit_snapshot(bigint,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.perci_commit_snapshot(bigint,jsonb,jsonb)
  TO authenticated;

COMMIT;

-- IMPORTANTE: NO se retiran permisos INSERT/UPDATE/DELETE directos a
-- las tablas core. El cierre de esos escritores es OTRA migración, a ejecutar
-- durante el corte con clientes actualizados y control de cola offline.
-- La presencia de esta RPC NO habilita por sí sola el modo DEV del backend.
