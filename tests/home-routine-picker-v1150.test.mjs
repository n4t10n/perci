import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/src/styles.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const start=app.indexOf('function getRoutineHistory(){');
const end=app.indexOf('function renderHome(){',start);
assert.ok(start>0&&end>start,'El selector debe tener funciones independientes');
const code=app.slice(start,end);
const example={routines:[
  {id:'a',name:'Torso A',exercises:[{sets:3},{sets:4}]},
  {id:'b',name:'Piernas',exercises:[{sets:3}]},
  {id:'c',name:'Torso B',exercises:[{sets:4}]}],records:[
  {id:'1',type:'gym',name:'Torso A',routineId:'a',date:'2026-11-20'},
  {id:'2',type:'gym',name:'Piernas',routineId:'b',date:'2026-11-23'},
  {id:'3',type:'walk',name:'Caminata',date:'2026-11-24'}]};
const h=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const f=(state)=>new Function('state','h','back','title','button',code+';return {getRoutineHistory,renderRoutinePicker};')(
  state,h,()=>'<button>Volver</button>',(name,sub)=>`<h1>${name}</h1><p>${sub}</p>`,(label)=>`<button>${label}</button>`);
test('Inicio: Empezar a entrenar lleva al selector, no inicia la primera rutina',()=>{
  assert.match(app,/button\('Empezar a entrenar ↗','go','routinePicker'\)/);
  assert.match(app,/routinePicker:renderRoutinePicker/);
  assert.match(app,/routinePicker:'home'/);
});
test('Selector: identifica por ID la última rutina real independientemente del orden de tarjetas',()=>{
  const {getRoutineHistory,renderRoutinePicker}=f(example);
  const history=getRoutineHistory();
  assert.equal(history.keys().next().value,'b');
  const result=renderRoutinePicker();
  assert.match(result,/¿Qué rutina hacemos hoy\?/);
  assert.match(result,/data-action="start" data-value="a"/);
  assert.match(result,/data-action="start" data-value="b"/);
  assert.match(result,/data-action="start" data-value="c"/);
  assert.equal((result.match(/Última realizada/g)||[]).length,1);
  assert.match(result,/23 de nov de 2026/);
  assert.match(result,/Sin sesiones registradas/);
});
test('Historial: sesiones anteriores se reconocen por nombre único, pero no con nombres duplicados',()=>{
  const state={routines:[{id:'a',name:'Torso A',exercises:[]},{id:'b',name:'Piernas',exercises:[]}],
    records:[{type:'gym',name:'Torso A',date:'2026-11-12'}]};
  assert.equal(f(state).getRoutineHistory().get('a').date,'2026-11-12');
  state.routines.push({id:'c',name:'Torso A',exercises:[]});
  assert.equal(f(state).getRoutineHistory().size,0);
});
test('Historial: el ID de rutina prevalece incluso si cambió de nombre',()=>{
  const state={routines:[{id:'a',name:'Torso Renombrado',exercises:[]}],records:[
    {type:'gym',name:'Torso A',routineId:'a',date:'2026-11-21'}]};
  assert.equal(f(state).getRoutineHistory().get('a').date,'2026-11-21');
  assert.match(app,/note:'',routineId:d\.routineId,setDetails/);
});
test('PWA: selector accesible, identidad de assets consistente y nueva caché',()=>{
  assert.match(css,/\.routine-picker-grid\{/);
  assert.match(app,/role="group" aria-label="Rutinas para empezar"/);
  assert.match(app,/aria-label="Empezar \$\{h\(r\.name\)\}/);
  assert.match(sw,/perci-shell-v1\.15\.0-activity-date-layout/);
  assert.match(sw,/src\/app\.js\?v=1\.15\.0/);
  assert.match(sw,/src\/styles\.css\?v=1\.15\.0/);
  assert.match(html,/src\/app\.js\?v=1\.15\.0/);
});
