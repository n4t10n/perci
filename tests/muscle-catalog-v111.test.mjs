import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXERCISE_CATALOG,MUSCLE_GROUPS,normalizeExerciseName,muscleLabel,filterCatalogExercises,findCatalogExercise} from '../public/src/domain/exercise-catalog.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../public/src/app.js');
const css=read('../public/src/styles.css');
const sw=read('../public/sw.js');
const html=read('../public/index.html');
const old=['Press de banca','Sentadilla','Peso muerto','Remo con mancuerna','Press militar','Jalón al pecho','Prensa de piernas','Curl de bíceps','Plancha','Elevación lateral','Hip thrust','Dominadas'];
test('Catálogo: conserva los 12 ejercicios originales y agrega exactamente 7 nuevos',()=>{
  assert.equal(EXERCISE_CATALOG.length,19);
  assert.equal(EXERCISE_CATALOG.filter(x=>x.isNew).length,7);
  for(const name of old)assert.equal(EXERCISE_CATALOG.filter(x=>x.name===name).length,1,name);
  assert.equal(new Set(EXERCISE_CATALOG.map(x=>x.id)).size,19);
  assert.equal(new Set(EXERCISE_CATALOG.map(x=>normalizeExerciseName(x.name))).size,19);
});
test('Catálogo: siete grupos y un ejercicio añadido por grupo, sin categoría huérfana',()=>{
  const groups=MUSCLE_GROUPS.map(x=>x.id);
  assert.deepEqual(groups,['pecho','espalda','piernas','hombros','biceps','triceps','core']);
  for(const muscle of groups){
    assert.equal(EXERCISE_CATALOG.filter(x=>x.isNew&&x.muscle===muscle).length,1,muscle);
    assert.ok(muscleLabel(muscle).length>2);
  }
  assert.ok(EXERCISE_CATALOG.every(x=>groups.includes(x.muscle)));
});
test('Catálogo: búsqueda tolera tildes, espacios y mayúsculas sin modificar datos',()=>{
  const before=JSON.stringify(EXERCISE_CATALOG);
  assert.deepEqual(filterCatalogExercises(EXERCISE_CATALOG,{search:'  CURL   DE   BICEPS '}).map(x=>x.name),['Curl de bíceps']);
  assert.deepEqual(filterCatalogExercises(EXERCISE_CATALOG,{muscle:'triceps'}).map(x=>x.name),['Extensión de tríceps en polea']);
  assert.equal(filterCatalogExercises(EXERCISE_CATALOG,{muscle:'invalid'}).length,0);
  assert.equal(filterCatalogExercises(EXERCISE_CATALOG,{muscle:'pecho',search:'dominadas'}).length,0);
  assert.equal(filterCatalogExercises(EXERCISE_CATALOG,{search:'no-existe'}).length,0);
  assert.equal(filterCatalogExercises(EXERCISE_CATALOG).length,19);
  assert.equal(JSON.stringify(EXERCISE_CATALOG),before);
});
test('Catálogo: reconocedor exacto deja base estable para GIFs de siguiente versión',()=>{
  assert.equal(findCatalogExercise('  PÁJAROS  con mancuernas  ')?.id,'pajaros-mancuernas');
  assert.equal(findCatalogExercise('Press de banca')?.id,'press-banca');
  assert.equal(findCatalogExercise('Press de banca en máquina'),null);
  assert.equal(findCatalogExercise(''),null);
  assert.ok(Object.isFrozen(EXERCISE_CATALOG));
});
test('UX: biblioteca muestra filtro por músculos, selección accesible y búsqueda',()=>{
  assert.match(app,/role="group" aria-label="Filtrar ejercicios por grupo muscular"/);
  assert.match(app,/data-action="filterMuscle" data-value="\$\{group.id\}" aria-pressed=/);
  assert.match(app,/case 'filterMuscle':/);
  assert.match(app,/filterCatalogExercises\(lib,/);
  assert.match(app,/role="status" aria-live="polite"/);
  assert.match(app,/e\.target\.id==='libsearch'/);
  assert.match(css,/\.library-muscle-filters\{/);
  assert.match(css,/@media\(max-width:480px\)/);
});
test('Compatibilidad: añadir un ejercicio sigue guardando nombre, series y repeticiones originales',()=>{
  assert.match(app,/app\.editor\.exercises\.push\(\{name:value,sets:3,reps:10\}\)/);
  assert.match(app,/button\('\+ Añadir','addExercise',e\.name,'small'\)/);
  assert.match(app,/saveRoutineEditor\(app\.activeUid,app\.editor\)/);
  assert.match(app,/case 'addCustomExercise':/);
  assert.match(app,/const lib=\[\.\.\.EXERCISE_CATALOG\]/);
  const routineShare=read('../public/src/domain/routine-share.js');
  assert.match(routineShare,/return \{name, exercises\}/);
});
test('PWA: catálogo, HTML, CSS y SW pertenecen a v1.12.0 sin dividir account',()=>{
  assert.match(sw,/perci-shell-v1\.12\.3-in-app-demo/);
  assert.match(sw,/domain\/exercise-catalog\.js\?v=1\.12\.0/);
  assert.match(app,/domain\/exercise-catalog\.js\?v=1\.12\.0/);
  assert.match(sw,/src\/app\.js\?v=1\.12\.3/);
  assert.match(sw,/src\/styles\.css\?v=1\.12\.1/);
  assert.match(html,/src\/app\.js\?v=1\.12\.3/);
  assert.match(html,/src\/styles\.css\?v=1\.12\.1/);
  assert.match(sw,/domain\/historical-sets\.js\?v=1\.10\.0/);
});
