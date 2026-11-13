import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const appSource=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/src/styles.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const start=appSource.indexOf('function handle(action,value){switch(action){');
const end=appSource.indexOf("document.addEventListener('click'",start);
assert.ok(start>=0 && end>start,'Manejador de acciones no encontrado');
const handler=appSource.slice(start,end);
const makeController=({persist=true,withSets=false}={})=>{
  const draft={id:'test-session',routineId:'r1',startedAt:0,sets:withSets?{'0-0':{done:true,reps:10,weight:20}}:{}};
  const routines=[{id:'r1',name:'Entrenamiento',exercises:[{name:'Press',sets:2,reps:10}]}];
  const records=[{id:'old1',date:'2026-11-10',type:'gym',setDetails:[{exerciseName:'Press',weight:25}]}];
  const state={draft,routines,records};
  const app={modal:null};
  const navigations=[],toasts=[],saved=[];
  let renderCount=0;
  const showModal=(title,body,confirm,value,danger,extra,confirmLabel)=>{app.modal={title,body,confirm,danger,confirmLabel}};
  const save=()=>{saved.push(state.draft);return persist};
  const go=dest=>navigations.push(dest);
  const render=()=>{renderCount++};
  const act=new Function('state','app','save','go','toast','showModal','render',`${handler};return handle;`)(
    state,app,save,go,s=>toasts.push(s),showModal,render
  );
  return {act,state,app,draft,routines,records,saved,navigations,toasts,get renderCount(){return renderCount}};
};

test('UX: la sesión puede cancelarse desde Inicio, durante la sesión y al final',()=>{
  assert.match(appSource,/state\.draft\?button\('▶ Continuar sesión','continue','',''\)\+button\('Cancelar sesión','cancelSession'/);
  assert.match(appSource,/class="session-cancel-actions"/);
  assert.match(appSource,/class="session-end-actions"/);
  assert.match(appSource,/case 'cancelSession':/);
  assert.match(css,/\.hero \.btn\.session-cancel\{/);
});

test('Cancelar abre confirmación sin modificar la sesión, aun con 0 series',()=>{
  const x=makeController();
  x.act('cancelSession','');
  assert.equal(x.state.draft,x.draft);
  assert.deepEqual(x.saved,[]);
  assert.match(x.app.modal.title,/Cancelar esta sesión/);
  assert.equal(x.app.modal.confirm,'confirmCancelSession');
  assert.equal(x.app.modal.danger,true);
  assert.equal(x.app.modal.confirmLabel,'Descartar sesión');
});

test('Confirmar descarta solo la sesión y mantiene rutinas e historial',()=>{
  const x=makeController({withSets:true});
  const before=JSON.stringify({routines:x.routines,records:x.records});
  x.act('cancelSession','');
  x.act('confirmCancelSession','');
  assert.equal(x.state.draft,null);
  assert.deepEqual(x.saved,[null]);
  assert.equal(x.app.modal,null);
  assert.deepEqual(x.navigations,['activity']);
  assert.match(x.toasts[0],/descartada/);
  assert.equal(JSON.stringify({routines:x.routines,records:x.records}),before);
});

test('Si falla el guardado, no se pierde el borrador ni se navega',()=>{
  const x=makeController({persist:false,withSets:true});
  x.act('cancelSession','');
  x.act('confirmCancelSession','');
  assert.equal(x.state.draft,x.draft);
  assert.deepEqual(x.saved,[null]);
  assert.equal(x.navigations.length,0);
  assert.equal(x.renderCount,1);
  assert.equal(x.records.length,1);
});

test('Sin sesión activa no se abre confirmación',()=>{
  const x=makeController();
  x.state.draft=null;
  x.act('cancelSession','');
  assert.equal(x.app.modal,null);
  assert.deepEqual(x.saved,[]);
});

test('PWA: JavaScript y CSS del cambio se actualizan juntos',()=>{
  assert.match(sw,/perci-shell-v1\.12\.1-real-videos/);
  assert.match(sw,/src\/app\.js\?v=1\.12\.1/);
  assert.match(sw,/src\/styles\.css\?v=1\.12\.1/);
  assert.match(html,/src\/app\.js\?v=1\.12\.1/);
  assert.match(html,/src\/styles\.css\?v=1\.12\.1/);
});
