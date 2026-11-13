import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/src/styles.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const start=source.indexOf('function renderRoutineOverview(){');
const end=source.indexOf('const lib=[',start);
assert.ok(start>=0&&end>start,'No se encontraron los componentes de rutinas');
const fragment=source.slice(start,end);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,value='',cls='')=>`<button class="btn ${cls}" data-action="${action}" data-value="${esc(value)}">${label}</button>`;
const sample=[
 {id:'r1',name:'Día 1 Full Body',exercises:[{name:'Sentadilla',sets:4,reps:10},{name:'Press banca',sets:3,reps:10}]},
 {id:'r2',name:'Día 2 Full Body',exercises:[{name:'Remo',sets:4,reps:12}]},
 {id:'r3',name:'Día 3 Full Body',exercises:[{name:'Fondos',sets:3,reps:10}]},
];
function pages(routines=sample){
 const state={routines};
 const app={tab:'gym',activeUid:'user'};
 const title=(heading,sub)=>`<h1>${heading}</h1><p>${sub}</p>`;
 const back=where=>`<button data-action="go" data-value="${where}">Volver</button>`;
 return new Function('state','app','h','button','title','back','readRoutineEditor','isOfflineNow','account','categories',
   `${fragment};return {renderActivity,renderAllRoutines,renderRoutineOverview};`)(
   state,app,esc,button,title,back,()=>null,()=>false,{},[]);
}

test('Actividad muestra tarjetas compactas con fotos, sin desplegar listas de ejercicios',()=>{
 const html=pages().renderActivity();
 assert.equal((html.match(/class="image-strip"/g)||[]).length,3);
 assert.equal((html.match(/data-action="detailRoutine"/g)||[]).length,3);
 assert.equal((html.match(/data-action="start"/g)||[]).length,3);
 assert.doesNotMatch(html,/routine-overview-exercises/);
 assert.doesNotMatch(html,/4 series · 10 reps/);
 assert.ok(html.includes('Día 1 Full Body'));
 assert.match(html,/photo-1517836357463-d25dfeac3438/);
});

test('CTA exacto entre tarjetas y Biblioteca y sólo con rutinas existentes',()=>{
 const html=pages().renderActivity();
 const link=html.indexOf('Ver más de todas las rutinas');
 const library=html.indexOf('Biblioteca de ejercicios');
 const cards=html.indexOf('class="image-strip"');
 assert.ok(cards>=0 && link>cards && library>link);
 assert.match(html,/data-action="go" data-value="routinesOverview"[^>]*>Ver más de todas las rutinas/);
 assert.equal((html.match(/Ver más de todas las rutinas/g)||[]).length,1);
 assert.doesNotMatch(pages([]).renderActivity(),/Ver más de todas las rutinas/);
});

test('Vista secundaria mantiene todas las fotos, ejercicios, series y acciones',()=>{
 const html=pages().renderAllRoutines();
 assert.match(html,/Todas mis rutinas/);
 assert.match(html,/data-value="activity"/);
 assert.equal((html.match(/class="routine-overview-hero"/g)||[]).length,3);
 for(const text of ['Sentadilla','Press banca','Remo','Fondos','4 series · 10 reps'])assert.ok(html.includes(text),text);
 for(const action of ['start','detailRoutine','editRoutine'])
   assert.equal((html.match(new RegExp(`data-action="${action}"`,'g'))||[]).length,3);
});

test('Mantiene estado vacío y escapa nombres sin inyectar HTML',()=>{
 const empty=pages([]).renderActivity();
 assert.match(empty,/Tu primera rutina empieza acá/);
 assert.match(empty,/Crear mi rutina/);
 const html=pages([{id:'r1',name:'<script>alert(1)</script>',exercises:[{name:'Remo',sets:3,reps:10}]}]).renderActivity();
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/&lt;script&gt;/);
});

test('Nueva ruta forma parte de la navegación Actividad sin alterar editor ni fechas',()=>{
 assert.match(source,/routinesOverview:'activity'/);
 assert.match(source,/routinesOverview:renderAllRoutines/);
 assert.match(source,/case 'detailRoutine':app\.routineListOrigin=/);
 assert.match(source,/back\(app\.routineListOrigin\|\|'activity'\)/);
 assert.match(source,/case 'renameExercise':/);
 assert.match(source,/case 'reorderExercise':/);
 assert.match(source,/id="sessionDate"/);
 assert.match(css,/\.routine-all-link\{/);
 assert.match(sw,/perci-shell-v1\.9\.0-qa-accessibility-ux/);
});
