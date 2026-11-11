import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const beginning=source.indexOf('function renderRoutineOverview(){');
const ending=source.indexOf('function renderActivity(){',beginning);
assert.ok(beginning>=0 && ending>beginning,'La vista general debe estar declarada antes de Actividad');
const fragment=source.slice(beginning,ending);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,value='',cls='')=>`<button class="btn ${cls}" data-action="${action}" data-value="${escape(value)}">${label}</button>`;
const createOverview=state=>new Function('state','h','button',`${fragment};return renderRoutineOverview;`)(state,escape,button)();

test('v1.8: todas las rutinas y sus ejercicios aparecen juntos',()=>{
  const html=createOverview({routines:[
    {id:'r1',name:'Pecho y tríceps',exercises:[{name:'Press de banca',sets:4,reps:10},{name:'Fondos',sets:3,reps:12}]},
    {id:'r2',name:'Espalda',exercises:[{name:'Remo',sets:3,reps:8}]},
    {id:'r3',name:'Piernas',exercises:[{name:'Sentadilla',sets:4,reps:10}]}
  ]});
  assert.equal((html.match(/class="card routine-overview-card"/g)||[]).length,3);
  for(const name of ['Pecho y tríceps','Espalda','Piernas','Press de banca','Fondos','Remo','Sentadilla'])assert.ok(html.includes(name),name);
  assert.equal((html.match(/data-action="start"/g)||[]).length,3);
  assert.equal((html.match(/data-action="detailRoutine"/g)||[]).length,3);
  assert.equal((html.match(/data-action="editRoutine"/g)||[]).length,3);
  assert.match(html,/4 series · 10 reps/);
});
test('v1.8: lectura no modifica las rutinas y escapa HTML',()=>{
  const routines=[{id:'r1',name:'A <B>',exercises:[{name:'<img src=x onerror=alert(1)>',sets:3,reps:10}]}];
  const before=JSON.stringify(routines);
  const html=createOverview({routines});
  assert.equal(JSON.stringify(routines),before);
  assert.ok(html.includes('A &lt;B&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img src=x'));
});
test('v1.8: estado vacío mantiene el acceso para crear rutina',()=>{
  const html=createOverview({routines:[]});
  assert.match(html,/Tu primera rutina empieza acá/);
  assert.match(html,/data-action="editRoutine"/);
});

test('v1.8: cada rutina recupera su cabecera fotográfica y conserva accesos',()=>{
  const html=createOverview({routines:[
    {id:'r1',name:'Día 1 Full Body',exercises:[{name:'Press de banca',sets:4,reps:10}]},
    {id:'r2',name:'Día 2 Full Body',exercises:[{name:'Sentadilla',sets:4,reps:10}]},
    {id:'r3',name:'Día 3 Full Body',exercises:[{name:'Remo',sets:3,reps:12}]}
  ]});
  assert.equal((html.match(/class="routine-overview-hero"/g)||[]).length,3);
  assert.match(html,/--routine-photo:url\(https:\/\/images\.unsplash\.com\/photo-1517836357463-d25dfeac3438/);
  for(const action of ['start','detailRoutine','editRoutine']){
    assert.equal((html.match(new RegExp('data-action="'+action+'"','g'))||[]).length,3);
  }
  assert.match(html,/Día 1 Full Body/);
  assert.match(html,/Press de banca/);
  assert.match(html,/Sentadilla/);
});
