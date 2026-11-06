/**
 * Fase B / Paso 2: normalizador de lectura, NO sube datos ni los modifica.
 * Conserva client_id del prototipo (no son UUID), para evitar duplicados al importar.
 */
export const REMOTE_SCHEMA_VERSION = 1;
const types = new Set(['gym','walk','run','cycle','sport','other']);
const dateOk = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s)) && new Date(s+'T12:00:00Z').toISOString().slice(0,10) === s;
const safeArray = v => Array.isArray(v) ? v : [];
export const clientId = (entity, localId) => `perci-v04:${entity}:${String(localId)}`;

export function previewLocalMigration(snapshot) {
  const errors = [], warnings = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return {ready:false, errors:['No se encontró un estado local válido.'],warnings:[],counts:{}};
  }
  for (const key of ['routines','records','habits']) {
    if (!Array.isArray(snapshot[key])) errors.push(`Falta una lista válida de ${key}.`);
  }
  const routines=safeArray(snapshot.routines), records=safeArray(snapshot.records), habits=safeArray(snapshot.habits);
  const seen={routines:new Set(),records:new Set(),habits:new Set()};
  for (const [kind, items] of [['routines',routines],['records',records],['habits',habits]]) {
    for (const row of items) {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id.trim()) {
        errors.push(`${kind}: elemento sin identificador local.`); continue;
      }
      if (seen[kind].has(row.id)) errors.push(`${kind}: identificador repetido ${row.id}.`);
      seen[kind].add(row.id);
      if (typeof row.name !== 'string' || !row.name.trim()) errors.push(`${kind}: elemento sin nombre (${row.id}).`);
    }
  }
  let exercises=0;
  for (const routine of routines) {
    if (!Array.isArray(routine?.exercises)) {errors.push('Rutina sin lista válida de ejercicios.');continue;}
    exercises+=routine.exercises.length;
    routine.exercises.forEach((exercise,index)=>{
      if (!exercise || typeof exercise.name !== 'string' || !exercise.name.trim() || !(Number(exercise.sets)>=1&&Number(exercise.sets)<=15) || !(Number(exercise.reps)>=1&&Number(exercise.reps)<=100)) errors.push(`Rutina ${routine.id}, ejercicio ${index+1}: campos inválidos.`);
    });
  }
  for (const record of records) {
    if (!types.has(record?.type)) errors.push(`Actividad ${record?.id ?? '?'}: tipo inválido.`);
    if (!dateOk(record?.date)) errors.push(`Actividad ${record?.id ?? '?'}: fecha inválida.`);
    if (!Number.isFinite(Number(record?.minutes))||Number(record.minutes)<1||Number(record.minutes)>1440) errors.push(`Actividad ${record?.id ?? '?'}: duración inválida.`);
  }
  for (const habit of habits) {
    if (!Array.isArray(habit?.days)||!habit.days.length||habit.days.some(day=>!Number.isInteger(day)||day<0||day>6)) errors.push(`Hábito ${habit?.id ?? '?'}: días inválidos.`);
  }
  const checks = snapshot.checks && typeof snapshot.checks==='object' && !Array.isArray(snapshot.checks) ? snapshot.checks : {};
  let completions=0;
  for (const [key, value] of Object.entries(checks)) {
    const sep=key.lastIndexOf(':'); const habitId=key.slice(0,sep); const date=key.slice(sep+1);
    if (sep<1||!seen.habits.has(habitId)||!dateOk(date)) errors.push(`Check inválido: ${key}.`);
    if (value===true) completions++;
  }
  if (snapshot.demo) warnings.push('Hay datos de demostración mezclados con posibles registros reales. Revisar antes de migrar.');
  if (records.some(r=>r?.type==='gym'&&r.setsDone&&!r.setDetails)) warnings.push('Algunas sesiones históricas solo conservan resúmenes; no se inventarán series.');
  if (snapshot.draft) warnings.push('Hay una sesión activa: preservarla y finalizarla antes de migrar.');
  warnings.push('Esta verificación es local. No crea usuarios, tablas ni escrituras remotas.');
  return {ready:errors.length===0,errors,warnings,
    counts:{routines:routines.length,exercises,records:records.length,habits:habits.length,completions,drafts:snapshot.draft?1:0},
    schemaVersion:REMOTE_SCHEMA_VERSION,sourceVersion:snapshot.version??'legacy'};
}
