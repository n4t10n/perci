import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reorderRoutineExercises,isWorkoutDate,getWorkoutDate} from '../public/src/domain/routine-session-tools.js';

const app=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/src/styles.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const slice=(from,to)=>{
  const a=app.indexOf(from), b=app.indexOf(to,a+from.length);
  assert.ok(a>=0&&b>a,`No encontramos el bloque: ${from} -> ${to}`);
  return app.slice(a,b);
};

test('reordenar conserva ejercicios, atributos y posición solicitada sin modificar el original',()=>{
  const original=[{name:'Sentadilla',sets:4,reps:10},{name:'Press',sets:3,reps:8},{name:'Remo',sets:4,reps:12}];
  const before=JSON.stringify(original);
  const moved=reorderRoutineExercises(original,2,0);
  assert.deepEqual(moved.map(e=>e.name),['Remo','Sentadilla','Press']);
  assert.equal(moved[0].sets,4);
  assert.equal(moved[0].reps,12);
  assert.equal(JSON.stringify(original),before);
  assert.deepEqual(reorderRoutineExercises(moved,0,2).map(e=>e.name),['Sentadilla','Press','Remo']);
});

test('reordenar rechaza índices incorrectos, sin pérdida ni duplicación',()=>{
  const ex=[{name:'Uno'},{name:'Dos'}];
  for(const [a,b] of [[0,0],[-1,1],[0,2],[2,0],[0,NaN],[0,'1']]) {
    assert.equal(reorderRoutineExercises(ex,a,b),ex);
  }
  assert.deepEqual(ex.map(e=>e.name),['Uno','Dos']);
});

test('fechas: acepta días reales pasados/hoy, rechaza fechas futuras y calendarios imposibles',()=>{
  for(const date of ['2026-11-11','2026-11-09','2024-02-29'])assert.equal(isWorkoutDate(date,'2026-11-11'),true);
  for(const date of ['2026-11-12','2026-02-30','2025-02-29','2026-13-01','2026-00-10','','11/11/2026'])
    assert.equal(isWorkoutDate(date,'2026-11-11'),false,date);
});

test('fecha por defecto: respeta día de inicio y la fecha elegida al reabrir borrador',()=>{
  assert.equal(getWorkoutDate({sessionDate:'2026-11-08'},'2026-11-11','2026-11-10'),'2026-11-08');
  assert.equal(getWorkoutDate({},'2026-11-11','2026-11-09'),'2026-11-09');
  assert.equal(getWorkoutDate({sessionDate:'2026-11-30'},'2026-11-11','2026-11-10'),'2026-11-10');
  assert.equal(getWorkoutDate({},'2026-11-11','invalid'),'2026-11-11');
});

test('editor: muestra asas táctiles, flechas y persiste los cambios en borrador',()=>{
  const renderer=slice('function renderRoutineEdit(){','const asKg=');
  assert.match(renderer,/data-exercise-drag/);
  assert.match(renderer,/data-action="reorderExercise"/);
  assert.match(renderer,/aria-label="Subir/);
  assert.match(renderer,/aria-label="Bajar/);
  const handler=slice("case 'reorderExercise':","case 'renameExercise':");
  assert.match(handler,/persistEditor\(\)/);
  assert.match(handler,/reorderRoutineExercises\(/);
  assert.match(handler,/saveRoutineEditor\(/);
  assert.doesNotMatch(handler,/state\.(records|draft)\s*=/);
  assert.match(app,/addEventListener\('pointerdown'/);
  assert.match(app,/addEventListener\('pointermove'/);
  assert.match(app,/addEventListener\('pointerup'/);
  assert.match(css,/touch-action:none/);
});

test('sesión: fecha editable en curso y persistida como fecha real al finalizar',()=>{
  const renderer=slice('function renderSession(){','function renderSessionSummary(){');
  assert.match(renderer,/id="sessionDate"/);
  assert.match(renderer,/type="date"/);
  assert.match(renderer,/getWorkoutDate\(d,/);
  const start=slice('function beginSession(', 'function deleteRecordConfirmed(');
  assert.match(start,/sessionDate:dateISO\(\)/);
  const change=slice("document.addEventListener('change',", "document.addEventListener('keydown',");
  assert.match(change,/isWorkoutDate\(/);
  assert.match(change,/state\.draft\.sessionDate=selected/);
  assert.match(change,/save\(\)/);
  const finish=slice("case 'confirmFinish':", "case 'other':");
  assert.match(finish,/date:getWorkoutDate\(d,/);
  assert.doesNotMatch(finish,/date:dateISO\(\)/);
  const summary=slice('function renderSessionSummary(){','function renderOtherForm(){');
  assert.match(summary,/Corregir fecha/);
  assert.match(summary,/detailRecord/);
  assert.match(sw,/routine-session-tools\.js\?v=1\.7\.6/);
});

test('registros anteriores conservan la edición de fecha sin tocar las series',()=>{
  assert.match(app,/case 'saveRecord':/);
  assert.match(app,/r\.date=dt/);
  assert.match(app,/data-action="detailRecord"/);
});
test('acción de reordenar: persiste en borrador sin editar registros históricos',()=>{
  const handler=slice('function handle(action,value){switch(action){',"document.addEventListener('click'");
  const original=[{name:'A',sets:4,reps:8},{name:'B',sets:3,reps:12},{name:'C',sets:2,reps:10}];
  const state={records:[{date:'2026-11-10',setDetails:[{exerciseName:'A'}]}]};
  const appState={activeUid:'test',editor:{id:'r1',name:'Fuerza',exercises:original},renamingExercise:null};
  let saved=null, renders=0;
  const act=new Function('app','persistEditor','reorderRoutineExercises','saveRoutineEditor','render','toast',`${handler};return handle;`)(
    appState,()=>{},reorderRoutineExercises,(_uid,draft)=>{saved=structuredClone(draft)},()=>renders++,()=>{}
  );
  act('reorderExercise','2:0');
  assert.deepEqual(appState.editor.exercises.map(x=>x.name),['C','A','B']);
  assert.deepEqual(saved.exercises.map(x=>x.name),['C','A','B']);
  assert.equal(renders,1);
  assert.deepEqual(state.records[0].setDetails,[{exerciseName:'A'}]);
  act('reorderExercise','0:999');
  assert.equal(renders,1);
});

test('finalizar sesión: guarda fecha elegida y las series originales',()=>{
  const handler=slice('function handle(action,value){switch(action){',"document.addEventListener('click'");
  const draft={routineId:'r1',startedAt:Date.now()-60000,sessionDate:'2026-11-09',
    snapshot:[{name:'Press de banca',sets:1,reps:10}],sets:{'0-0':{done:true,weight:40,reps:10}}};
  const state={draft,routines:[{id:'r1',name:'Pecho',exercises:draft.snapshot}],records:[]};
  const appState={completedRecord:null,modal:{}};
  const act=new Function('state','app','id','dateISO','getWorkoutDate','save','go','toast','isOfflineNow','account',`${handler};return handle;`)(
    state,appState,()=>'registro1',()=> '2026-11-11',getWorkoutDate,()=>true,()=>{},()=>{},()=>false,{}
  );
  act('confirmFinish','');
  assert.equal(state.records[0].date,'2026-11-09');
  assert.equal(state.records[0].volume,400);
  assert.equal(state.records[0].setDetails[0].exerciseName,'Press de banca');
  assert.equal(state.records[0].setDetails[0].weight,40);
  assert.equal(state.draft,null);
});

test('fecha en mobile: input de Safari no excede la tarjeta y se renueva la caché CSS',()=>{
  assert.match(css,/\.workout-date-input input\{[^}]*min-width:0;max-width:100%/);
  assert.match(css,/@media\(max-width:480px\)\{\.workout-date-panel\{[^}]*\}\.workout-date-panel>div\{min-width:0\}\.workout-date-input\{[^}]*width:100%/);
  assert.match(sw,/perci-shell-v1\.12\.3-in-app-demo/);
  assert.match(sw,/src\/styles\.css\?v=1\.12\.1/);
});


test('iOS: fecha visible propia dentro de un contenedor recortado, con calendario nativo editable',()=>{
  assert.match(app,/class="workout-date-control"/);
  assert.match(app,/id="sessionDateText" aria-hidden="true"/);
  assert.match(app,/input type="date" id="sessionDate"/);
  assert.match(app,/if\(display\)display\.textContent=formatSessionDate\(selected\)/);
  assert.match(css,/\.workout-date-control\{[^}]*overflow:hidden/);
  assert.match(css,/\.workout-date-control input\[type=date\]\{[^}]*opacity:0/);
  assert.match(sw,/\.\/src\/app\.js\?v=1\.12\.3/);
});
