/** Percí v1.11.0 · Catálogo propio y categorizado, sin datos personales. */
export const MUSCLE_GROUPS = Object.freeze([
  Object.freeze({id:'pecho',label:'Pecho'}),
  Object.freeze({id:'espalda',label:'Espalda'}),
  Object.freeze({id:'piernas',label:'Piernas y glúteos'}),
  Object.freeze({id:'hombros',label:'Hombros'}),
  Object.freeze({id:'biceps',label:'Bíceps'}),
  Object.freeze({id:'triceps',label:'Tríceps'}),
  Object.freeze({id:'core',label:'Core'}),
]);
const base = [
  ['press-banca','Press de banca','pecho'],
  ['sentadilla','Sentadilla','piernas'],
  ['peso-muerto','Peso muerto','piernas'],
  ['remo-mancuerna','Remo con mancuerna','espalda'],
  ['press-militar','Press militar','hombros'],
  ['jalon-pecho','Jalón al pecho','espalda'],
  ['prensa-piernas','Prensa de piernas','piernas'],
  ['curl-biceps','Curl de bíceps','biceps'],
  ['plancha','Plancha','core'],
  ['elevacion-lateral','Elevación lateral','hombros'],
  ['hip-thrust','Hip thrust','piernas'],
  ['dominadas','Dominadas','espalda'],
];
const added = [
  ['aperturas-mancuernas','Aperturas con mancuernas','pecho'],
  ['remo-polea-baja','Remo en polea baja','espalda'],
  ['peso-muerto-rumano','Peso muerto rumano','piernas'],
  ['pajaros-mancuernas','Pájaros con mancuernas','hombros'],
  ['curl-martillo','Curl martillo','biceps'],
  ['extension-triceps-polea','Extensión de tríceps en polea','triceps'],
  ['crunch-abdominal','Crunch abdominal','core'],
];
export const EXERCISE_CATALOG = Object.freeze([
  ...base.map(([id,name,muscle])=>Object.freeze({id,name,muscle,isNew:false})),
  ...added.map(([id,name,muscle])=>Object.freeze({id,name,muscle,isNew:true})),
]);
export const normalizeExerciseName = value => String(value??'').trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLocaleLowerCase('es-AR');
export const muscleLabel = id => MUSCLE_GROUPS.find(g=>g.id===id)?.label||'Sin clasificar';
export function filterCatalogExercises(items=EXERCISE_CATALOG,{muscle='all',search=''}={}){
  if(muscle!=='all'&&!MUSCLE_GROUPS.some(g=>g.id===muscle))return [];
  const term=normalizeExerciseName(search);
  return items.filter(item=>(muscle==='all'||item.muscle===muscle)&&
    (!term||normalizeExerciseName(item.name).includes(term)));
}
export const findCatalogExercise = name => EXERCISE_CATALOG.find(
  item=>normalizeExerciseName(item.name)===normalizeExerciseName(name))||null;
