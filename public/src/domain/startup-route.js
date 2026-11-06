/**
 * Ruta de entrada: el usuario nuevo ve Bienvenida y quien tiene progreso
 * propio ve Inicio. Nunca se arranca en Ajustes por restaurar Safari.
 * No escribe ni modifica datos locales.
 */
export function getInitialView(state) {
  if (!state || typeof state !== 'object') return 'onboard';
  if (state.version === 3 && state.onboardSeen !== true && state.demo === false &&
      !state.routines?.length && !state.records?.length && !state.habits?.length) return 'onboard';
  if (state.onboardSeen === true || state.demo === false) return 'home';

  // En las versiones v0.4/v0.5 se podía crear una rutina propia antes de
  // marcar el onboarding como completo. Respetar ese progreso al actualizar.
  const hasCustomRoutine = Array.isArray(state.routines) &&
    state.routines.some(item => item && item.id !== 'r1');
  const hasCustomRecord = Array.isArray(state.records) &&
    state.records.some(item => item && !['s1', 's2', 's3'].includes(item.id));
  const hasCustomHabit = Array.isArray(state.habits) &&
    state.habits.some(item => item && !['h1', 'h2'].includes(item.id));
  const hasDraft = Boolean(state.draft);
  const hasChecks = Boolean(state.checks && Object.keys(state.checks).length);

  return (hasCustomRoutine || hasCustomRecord || hasCustomHabit || hasDraft || hasChecks)
    ? 'home'
    : 'onboard';
}
