-- PERCÍ v1.18.0 · SOLO SUPABASE QA: vafurtauwarukdcopjnh
-- Ejecutar después de preparar y probar el código, antes de publicar QA.
-- Verificar manualmente el proyecto en la URL del SQL Editor. SQL no puede
-- comprobar de forma fiable la referencia de proyecto desde PostgreSQL.
-- Cambio aditivo y transaccional. No ejecutar en DEV ni producción.
BEGIN;
DO $migration$
DECLARE
  fn text;
  old text;
  new text;
  i integer;
  anchors text[] := ARRAY[
    'if p_expected_revision is null or p_expected_revision < 0 then',
    '(user_id,routine_id,client_id,position,name,target_sets,target_reps)',
    '(v_child->>''sets'')::integer,(v_child->>''reps'')::integer',
    '(user_id,client_id,activity_type,name,activity_date,minutes,distance_km,sets_done,volume_kg,note)',
    'left(coalesce(v_item->>''note'',''''),400)',
    'volume_kg=excluded.volume_kg,note=excluded.note',
    '(user_id,record_id,exercise_position,exercise_name,set_number,reps,weight_kg,completed)',
    'coalesce((v_child->>''completed'')::boolean,true)'
  ];
  replacements text[] := ARRAY[
    $a$if p_snapshot->>'exerciseContextVersion' is distinct from '1' then
    raise sqlstate 'PT412' using message='Actualizá Percí QA antes de sincronizar. No se modificaron datos.';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then$a$,
    '(user_id,routine_id,client_id,position,name,target_sets,target_reps,default_variant)',
    $a$(v_child->>'sets')::integer,(v_child->>'reps')::integer,nullif(v_child->>'defaultVariant','')$a$,
    '(user_id,client_id,activity_type,name,activity_date,minutes,distance_km,sets_done,volume_kg,note,exercise_notes)',
    $a$left(coalesce(v_item->>'note',''),400),coalesce(v_item->'exerciseNotes','[]'::jsonb)$a$,
    'volume_kg=excluded.volume_kg,note=excluded.note,exercise_notes=excluded.exercise_notes',
    '(user_id,record_id,exercise_position,exercise_name,set_number,reps,weight_kg,completed,exercise_variant)',
    $a$coalesce((v_child->>'completed')::boolean,true),nullif(v_child->>'variant','')$a$
  ];
BEGIN
  IF to_regprocedure('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)') IS NULL
     OR to_regprocedure('public.perci_commit_snapshot(bigint,jsonb,jsonb)') IS NULL
     OR to_regclass('public.perci_sync_state') IS NULL THEN
    RAISE EXCEPTION 'STOP: QA no tiene la sincronización atómica esperada';
  END IF;
  SELECT pg_get_functiondef('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure) INTO fn;
  IF position('exerciseContextVersion' IN fn)>0 THEN
    RAISE EXCEPTION 'STOP: migración ya aplicada o versión inesperada';
  END IF;
  FOR i IN 1..array_length(anchors,1) LOOP
    old:=anchors[i]; new:=replacements[i];
    IF (length(fn)-length(replace(fn,old,'')))/length(old) <> 1 THEN
      RAISE EXCEPTION 'STOP: función QA distinta de la esperada, ancla %',i;
    END IF;
    fn:=replace(fn,old,new);
  END LOOP;
  ALTER TABLE public.perci_routine_exercises ADD COLUMN default_variant text
    CHECK (default_variant IN ('barra','mancuernas','maquina','discos','polea','multipower'));
  ALTER TABLE public.perci_workout_sets ADD COLUMN exercise_variant text
    CHECK (exercise_variant IN ('barra','mancuernas','maquina','discos','polea','multipower'));
  ALTER TABLE public.perci_activity_records ADD COLUMN exercise_notes jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(exercise_notes)='array' AND jsonb_array_length(exercise_notes)<=100
      AND octet_length(exercise_notes::text)<=150000
      AND (activity_type='gym' OR exercise_notes='[]'::jsonb));
  -- Validación de notas también en BD: el RPC se puede invocar sin la API Python.
  -- Se agrega a la función existente; los controles de propietario, RLS,
  -- revisión, SECURITY DEFINER, search_path y ACL permanecen intactos.
  old := 'insert into public.perci_activity_records';
  IF (length(fn)-length(replace(fn,old,'')))/length(old) <> 1 THEN
    RAISE EXCEPTION 'STOP: bloque de actividades inesperado';
  END IF;
  fn:=replace(fn,old,$a$if v_item ? 'exerciseNotes' then
      if jsonb_typeof(v_item->'exerciseNotes') is distinct from 'array' then
        raise sqlstate 'PT400' using message='Observaciones inválidas.';
      end if;
      if jsonb_array_length(v_item->'exerciseNotes') > 100 then
        raise sqlstate 'PT400' using message='Demasiadas observaciones.';
      end if;
      for v_child in select value from jsonb_array_elements(v_item->'exerciseNotes') loop
        if jsonb_typeof(v_child) is distinct from 'object'
          or jsonb_typeof(v_child->'exercisePosition') is distinct from 'number'
          or coalesce(v_child->>'exercisePosition','') !~ '^(0|[1-9][0-9]?)$'
          or jsonb_typeof(v_child->'exerciseName') is distinct from 'string'
          or length(btrim(v_child->>'exerciseName')) not between 1 and 80
          or jsonb_typeof(v_child->'note') is distinct from 'string'
          or length(v_child->>'note') not between 1 and 250
          or (v_child ? 'variant' and (jsonb_typeof(v_child->'variant') is distinct from 'string'
            or v_child->>'variant' not in ('barra','mancuernas','maquina','discos','polea','multipower')))
          or (v_child - ARRAY['exercisePosition','exerciseName','note','variant']) <> '{}'::jsonb then
          raise sqlstate 'PT400' using message='Observación de ejercicio inválida.';
        end if;
      end loop;
      if (select count(distinct value->>'exercisePosition') from jsonb_array_elements(v_item->'exerciseNotes'))
         <> jsonb_array_length(v_item->'exerciseNotes') then
        raise sqlstate 'PT400' using message='Observaciones duplicadas.';
      end if;
    end if;
    insert into public.perci_activity_records$a$);
  EXECUTE fn;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid='perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'STOP: privilegios inesperados';
  END IF;
END;
$migration$;
COMMIT;
-- Refrescar el esquema de la API.
NOTIFY pgrst, 'reload schema';
-- Verificación: deben aparecer las tres columnas y rpc_v118=true.
SELECT table_name,column_name FROM information_schema.columns
WHERE table_schema='public' AND (table_name,column_name) IN
  (('perci_routine_exercises','default_variant'),('perci_workout_sets','exercise_variant'),('perci_activity_records','exercise_notes'))
ORDER BY table_name;
SELECT position('exerciseContextVersion' IN pg_get_functiondef('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure))>0 AS rpc_v118;
