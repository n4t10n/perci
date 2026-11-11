
-- PERCÍ 1.7.6
-- LABORATORIO LOCAL: cierre de escrituras directas.
-- NO ejecutar manualmente en Supabase DEV.

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.perci_sync_state') IS NULL
     OR to_regprocedure(
       'public.perci_commit_snapshot(bigint,jsonb,jsonb)'
     ) IS NULL
  THEN
    RAISE EXCEPTION
      'STOP: motor atomico no instalado';
  END IF;
END
$guard$;

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.perci_profiles,
  public.perci_routines,
  public.perci_routine_exercises,
  public.perci_activity_records,
  public.perci_workout_sets,
  public.perci_habits,
  public.perci_habit_checks,
  public.perci_workout_drafts
FROM PUBLIC, anon, authenticated;

-- Comprobaciones automáticas de privilegios.
DO $check$
DECLARE
  tab text;
  tbl text;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'perci_profiles',
    'perci_routines',
    'perci_routine_exercises',
    'perci_activity_records',
    'perci_workout_sets',
    'perci_habits',
    'perci_habit_checks',
    'perci_workout_drafts'
  ]
  LOOP
    tbl := format('public.%I', tab);

    IF has_table_privilege(
         'authenticated', tbl, 'INSERT'
       )
       OR has_table_privilege(
         'authenticated', tbl, 'UPDATE'
       )
       OR has_table_privilege(
         'authenticated', tbl, 'DELETE'
       )
    THEN
      RAISE EXCEPTION
        'STOP: escritura directa habilitada en %', tbl;
    END IF;

    IF NOT has_table_privilege(
      'authenticated', tbl, 'SELECT'
    )
    THEN
      RAISE EXCEPTION
        'STOP: lectura perdida en %', tbl;
    END IF;
  END LOOP;

  IF NOT has_function_privilege(
    'authenticated',
    'public.perci_commit_snapshot(bigint,jsonb,jsonb)',
    'EXECUTE'
  )
  THEN
    RAISE EXCEPTION
      'STOP: RPC atomico no ejecutable';
  END IF;
END
$check$;

COMMIT;
