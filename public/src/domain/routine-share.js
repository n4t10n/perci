/** Percí Share v1.6.5 | Rutinas transferibles entre cuentas, solo plantillas. */
export const SHARE_CODE_PATTERN = /^PERC-[A-Za-z0-9_-]{16}$/;
export const isValidShareCode = value => typeof value === 'string' && SHARE_CODE_PATTERN.test(value);

export function cleanSharedRoutine(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Rutina inválida.');
  if (typeof input.name !== 'string') throw Error('Nombre de rutina inválido.');
  const name = input.name.trim();
  if (!name || name.length > 80 || !Array.isArray(input.exercises) ||
      input.exercises.length < 1 || input.exercises.length > 40) throw Error('Rutina inválida.');
  const exercises = input.exercises.map(x => {
    if (!x || typeof x !== 'object' || typeof x.name !== 'string' ||
        !x.name.trim() || x.name.trim().length > 80 ||
        !Number.isInteger(x.sets) || x.sets < 1 || x.sets > 15 ||
        !Number.isInteger(x.reps) || x.reps < 1 || x.reps > 100)
      throw Error('Un ejercicio compartido es inválido.');
    return {name:x.name.trim(),sets:x.sets,reps:x.reps};
  });
  return {name, exercises};
}

export function routineTemplateIsEqual(a,b) {
  try { return JSON.stringify(cleanSharedRoutine(a))===JSON.stringify(cleanSharedRoutine(b)); }
  catch { return false; }
}
