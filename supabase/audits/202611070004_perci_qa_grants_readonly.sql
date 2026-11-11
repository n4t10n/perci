-- Auditoría: cada tabla debe permitir SELECT, pero prohibir escrituras REST
-- directas a authenticated. SOLO LECTURA en el proyecto perci-qa.
with tab(n) as (values
  ('perci_profiles'),('perci_routines'),('perci_routine_exercises'),
  ('perci_activity_records'),('perci_workout_sets'),('perci_habits'),
  ('perci_habit_checks'),('perci_workout_drafts'),('perci_sync_state')
)
select n as tabla,
  has_table_privilege('authenticated', format('public.%I', n), 'SELECT') as lectura,
  not has_table_privilege('authenticated', format('public.%I', n), 'INSERT') as sin_insert,
  not has_table_privilege('authenticated', format('public.%I', n), 'UPDATE') as sin_update,
  not has_table_privilege('authenticated', format('public.%I', n), 'DELETE') as sin_delete
from tab order by n;
