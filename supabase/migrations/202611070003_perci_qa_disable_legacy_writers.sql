-- PERCÍ v1.7.2 · ENDURECIMIENTO DEV QA, NO PRODUCCIÓN
-- Ejecutar SOLO en perci-qa, una vez validada v1.7.1.
-- Defensa: clientes viejos que usan /rest/v1/<tabla> deben tener sus
-- escrituras denegadas. La RPC privileged SECURITY DEFINER mantiene su
-- permiso transaccional exclusivamente en el usuario autenticado (auth.uid()).
-- El editor SQL corre con rol postgres (no usar cuentas de la aplicación).
begin;

-- Fallar en proyectos que no tengan la RPC y el esquema del laboratorio.
do $$ begin
  if to_regprocedure('public.perci_commit_snapshot(bigint,jsonb,jsonb)') is null
     or to_regclass('public.perci_sync_state') is null then
    raise exception 'No se encuentra la instalación atómica v1.7.1';
  end if;
end $$;

revoke insert, update, delete on
  public.perci_profiles,
  public.perci_routines,
  public.perci_routine_exercises,
  public.perci_activity_records,
  public.perci_workout_sets,
  public.perci_habits,
  public.perci_habit_checks,
  public.perci_workout_drafts
from authenticated;

-- Los SELECT siguen disponibles bajo RLS: la API continúa leyendo snapshots.
-- La tabla perci_sync_state ya es lectura exclusiva en v1.7.1.
commit;
