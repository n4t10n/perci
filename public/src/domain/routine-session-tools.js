/** Percí · utilidades de UX sin efectos sobre el historial ni la nube. */
export function reorderRoutineExercises(exercises, source, destination) {
  if (!Array.isArray(exercises) || !Number.isInteger(source) || !Number.isInteger(destination)
      || source < 0 || destination < 0 || source >= exercises.length || destination >= exercises.length
      || source === destination) return exercises;
  const sorted = [...exercises];
  sorted.splice(destination, 0, ...sorted.splice(source, 1));
  return sorted;
}

// Una sesión puede registrarse después del día en que se realizó, pero no en el futuro.
export function isWorkoutDate(value, today) {
  if (typeof value !== 'string' || typeof today !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !/^\d{4}-\d{2}-\d{2}$/.test(today) || value > today) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}

// Compatibilidad con sesiones anteriores a esta mejora: recuperar el día de inicio.
export function getWorkoutDate(draft, today, startedOn) {
  if (isWorkoutDate(draft?.sessionDate,today)) return draft.sessionDate;
  if (isWorkoutDate(startedOn,today)) return startedOn;
  return today;
}
