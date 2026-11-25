-- PERCÍ v1.19.0. SOLO QA: vafurtauwarukdcopjnh.
-- Ejecutar únicamente después de que el script Mac pase todas las pruebas.
BEGIN;
DO $migration$
DECLARE
  fn text;
  old text;
  new text;
  i integer;
  anchors text[] := ARRAY[
    $a$p_snapshot->>'exerciseContextVersion' is distinct from '1'$a$,
    $a$insert into public.perci_profiles (user_id, theme, focus, onboarding_done)$a$,
    $a$coalesce((p_snapshot->>'onboardSeen') = 'true', false)$a$,
    $a$theme=excluded.theme, focus=excluded.focus,$a$,
    $a$v_child->>'variant' not in ('barra','mancuernas','maquina','discos','polea','multipower')$a$
  ];
  replacements text[] := ARRAY[
    $a$p_snapshot->>'exerciseContextVersion' is distinct from '2'$a$,
    $a$insert into public.perci_profiles (user_id, theme, focus, onboarding_done, custom_variants)$a$,
    $a$coalesce((p_snapshot->>'onboardSeen') = 'true', false),coalesce(p_snapshot->'customVariants','[]'::jsonb)$a$,
    $a$theme=excluded.theme, focus=excluded.focus, custom_variants=excluded.custom_variants,$a$,
    $a$NOT perci_private.perci_valid_variant_v119(v_child->>'variant')$a$
  ];
BEGIN
  IF to_regprocedure('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'STOP: falta RPC atómica QA';
  END IF;
  SELECT pg_get_functiondef('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure) INTO fn;
  FOR i IN 1..array_length(anchors,1) LOOP
    old:=anchors[i];new:=replacements[i];
    IF (length(fn)-length(replace(fn,old,'')))/length(old)<>1 THEN
      RAISE EXCEPTION 'STOP: RPC distinta de v1.18.0, ancla %',i;
    END IF;
    fn:=replace(fn,old,new);
  END LOOP;
  -- El registro pertenece al perfil privado existente. No se modifica RLS.
  ALTER TABLE public.perci_profiles ADD COLUMN custom_variants jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(custom_variants)='array' AND jsonb_array_length(custom_variants)<=300
       AND octet_length(custom_variants::text)<=100000);
  -- Reemplazar solo las restricciones introducidas por v1.18.0.
  ALTER TABLE public.perci_routine_exercises DROP CONSTRAINT perci_routine_exercises_default_variant_check;
  ALTER TABLE public.perci_workout_sets DROP CONSTRAINT perci_workout_sets_exercise_variant_check;
  EXECUTE $ddl$CREATE FUNCTION perci_private.perci_valid_variant_v119(v text)
      RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $body$
      SELECT coalesce(v IN ('barra','mancuernas','maquina','discos','polea','multipower','bilateral','unilateral','barra-ez','peso-corporal','agarre-abierto','agarre-cerrado','agarre-neutro','agarre-supino','prensa-45','prensa-horizontal','prensa-vertical','cuerda','barra-recta','barra-v') OR v ~ '^custom:[a-z0-9][a-z0-9 -]{0,39}$',false)
      $body$$ddl$;
  REVOKE ALL ON FUNCTION perci_private.perci_valid_variant_v119(text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION perci_private.perci_valid_variant_v119(text) TO authenticated;
  ALTER TABLE public.perci_routine_exercises ADD CONSTRAINT perci_routine_exercises_default_variant_check
    CHECK (default_variant IS NULL OR perci_private.perci_valid_variant_v119(default_variant));
  ALTER TABLE public.perci_workout_sets ADD CONSTRAINT perci_workout_sets_exercise_variant_check
    CHECK (exercise_variant IS NULL OR perci_private.perci_valid_variant_v119(exercise_variant));
  old:='insert into public.perci_profiles';
  IF (length(fn)-length(replace(fn,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'STOP: bloque perfil inesperado';END IF;
  fn:=replace(fn,old,$a$if p_snapshot ? 'customVariants' then
    if jsonb_typeof(p_snapshot->'customVariants') is distinct from 'array' then
      raise sqlstate 'PT400' using message='Variantes personalizadas inválidas.';
    end if;
    if jsonb_array_length(p_snapshot->'customVariants')>300 then
      raise sqlstate 'PT400' using message='Demasiadas variantes personalizadas.';
    end if;
    for v_child in select value from jsonb_array_elements(p_snapshot->'customVariants') loop
      if jsonb_typeof(v_child) is distinct from 'object'
        or (v_child - ARRAY['exercise','variant','active']) <> '{}'::jsonb
        or jsonb_typeof(v_child->'exercise') is distinct from 'string'
        or length(btrim(v_child->>'exercise')) not between 1 and 80
        or jsonb_typeof(v_child->'variant') is distinct from 'string'
        or coalesce(v_child->>'variant','') !~ '^custom:[a-z0-9][a-z0-9 -]{0,39}$'
        or jsonb_typeof(v_child->'active') is distinct from 'boolean' then
        raise sqlstate 'PT400' using message='Variante personalizada inválida.';
      end if;
    end loop;
    if (select count(distinct (value->>'exercise',value->>'variant')) from jsonb_array_elements(p_snapshot->'customVariants')) <> jsonb_array_length(p_snapshot->'customVariants') then
      raise sqlstate 'PT400' using message='Variantes personalizadas duplicadas.';
    end if;
  end if;
  insert into public.perci_profiles$a$);
  EXECUTE fn;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid='perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'STOP: privilegios inesperados';
  END IF;
END;
$migration$;
COMMIT;
NOTIFY pgrst, 'reload schema';
SELECT position($a$exerciseContextVersion' is distinct from '2'$a$ IN pg_get_functiondef('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure))>0 AS rpc_v119,
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='perci_profiles' AND column_name='custom_variants') AS registry_v119;
