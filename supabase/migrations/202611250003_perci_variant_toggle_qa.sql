-- PERCÍ v1.19.1 — SOLO proyecto QA vafurtauwarukdcopjnh.
-- Ejecutar después de las pruebas locales. No ejecutar en DEV ni producción.
BEGIN;
DO $migration$
DECLARE
  fn text;
  old text;
  i integer;
  anchors text[] := ARRAY[
    $a$p_snapshot->>'exerciseContextVersion' is distinct from '2'$a$,
    $a$(user_id,routine_id,client_id,position,name,target_sets,target_reps,default_variant)$a$,
    $a$(v_child->>'sets')::integer,(v_child->>'reps')::integer,nullif(v_child->>'defaultVariant','')$a$
  ];
  replacements text[] := ARRAY[
    $a$p_snapshot->>'exerciseContextVersion' is distinct from '3'$a$,
    $a$(user_id,routine_id,client_id,position,name,target_sets,target_reps,default_variant,variants_enabled)$a$,
    $a$(v_child->>'sets')::integer,(v_child->>'reps')::integer,nullif(v_child->>'defaultVariant',''),(v_child->>'variantsEnabled')::boolean$a$
  ];
BEGIN
  IF to_regprocedure('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'STOP: falta RPC QA';
  END IF;
  SELECT pg_get_functiondef('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure) INTO fn;
  FOR i IN 1..array_length(anchors,1) LOOP
    old:=anchors[i];
    IF (length(fn)-length(replace(fn,old,'')))/length(old)<>1 THEN
      RAISE EXCEPTION 'STOP: RPC distinta de v1.19.0, ancla %',i;
    END IF;
    fn:=replace(fn,old,replacements[i]);
  END LOOP;
  old:='insert into public.perci_routine_exercises';
  IF (length(fn)-length(replace(fn,old,'')))/length(old)<>1 THEN
    RAISE EXCEPTION 'STOP: bloque de ejercicios inesperado';
  END IF;
  fn:=replace(fn,old,$a$if v_child ? 'variantsEnabled' and jsonb_typeof(v_child->'variantsEnabled') is distinct from 'boolean' then
        raise sqlstate 'PT400' using message='Preferencia de variantes inválida.';
      end if;
      insert into public.perci_routine_exercises$a$);
  ALTER TABLE public.perci_routine_exercises ADD COLUMN variants_enabled boolean;
  EXECUTE fn;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid='perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'STOP: privilegios inesperados';
  END IF;
END;
$migration$;
COMMIT;
NOTIFY pgrst, 'reload schema';
SELECT position($a$exerciseContextVersion' is distinct from '3'$a$ IN pg_get_functiondef('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure))>0 AS rpc_v1191,
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='perci_routine_exercises' AND column_name='variants_enabled' AND data_type='boolean') AS toggle_v1191;
