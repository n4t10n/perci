import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canAutoRefreshCloud,shouldRefreshOnNavigation} from '../public/src/data/auto-refresh.js';
import {reconcileCloudSnapshot} from '../public/src/data/auto-hydration.js';
import {planOfflineSync} from '../public/src/data/offline-outbox.js';

const clean=()=>({version:3,demo:false,routines:[],records:[],habits:[],checks:{},draft:null});
const habit={id:'habito_nuevo',name:'Leer diez minutos',days:[1,2,3,4,5],paused:false};
const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');

test('regresión Mac: editor viejo no puede impedir actualización en Hábitos',()=>{
  const params={uid:'user-1',authenticated:true,online:true,visible:true,legacyChoice:false,hydrating:false,conflict:false,modal:false,draft:false,view:'habits',editor:{id:'old'}};
  assert.equal(canAutoRefreshCloud(params),true);
  assert.match(app,/app\.editor=null;app\.habit=null;app\.record=null;app\.routine=null;app\.modal=null/);
  assert.doesNotMatch(app.slice(app.indexOf('function refreshAccountAutomatically('),app.indexOf('window.addEventListener(\'focus\'')),/app\.editor/);
});

test('sin recuperación manual: hábitat remoto nuevo aparece al fusionar estado local de cuenta',()=>{
  const routine={id:'r-personal',name:'Día 1',exercises:[{name:'Sentadilla',sets:3,reps:8}]};
  const mac={...clean(),routines:[routine]};
  const remote={...clean(),habits:[habit]};
  const outcome=reconcileCloudSnapshot(mac,remote);
  assert.equal(outcome.status,'merged');
  assert.deepEqual(outcome.snapshot.routines,[routine]);
  assert.deepEqual(outcome.snapshot.habits,[habit]);
});

test('cambios pendientes se fusionan sin borrar nuevos hábitos de la nube',()=>{
  const old=clean(),mac={...clean(),records:[{id:'activity1',type:'walk',name:'Caminata',date:'2026-11-06',minutes:20}]};
  const remote={...clean(),habits:[habit]};
  const plan=planOfflineSync(old,mac,remote);
  assert.equal(plan.safe,true);
  assert.deepEqual(plan.snapshot.habits,[habit]);
  assert.equal(plan.snapshot.records.length,1);
});

test('sincronización automática al abrir vistas de lectura, aunque no se regrese a la pestaña',()=>{
  for(const view of ['home','habits','activity','progress','account']){
    assert.equal(shouldRefreshOnNavigation(view),true);
  }
  assert.match(app,/if\(shouldRefreshOnNavigation\(v\)\)queueMicrotask\(\(\)=>refreshAccountAutomatically\(8000\)\)/);
  assert.match(app,/window\.addEventListener\('focus'/);
  assert.match(app,/document\.addEventListener\('visibilitychange'/);
  assert.match(app,/setInterval\(\(\)=>refreshAccountAutomatically\(30000\),30000\)/);
});

test('no interferir con formularios, entrenamiento, offline o sesión sin autenticar',()=>{
  const base={uid:'user-1',authenticated:true,online:true,visible:true,legacyChoice:false,hydrating:false,conflict:false,modal:false,draft:false,view:'home'};
  for(const view of ['routineEdit','record','session','otherForm','habitEdit']) assert.equal(canAutoRefreshCloud({...base,view}),false);
  for(const field of ['authenticated','online','visible']) assert.equal(canAutoRefreshCloud({...base,[field]:false}),false);
  for(const field of ['legacyChoice','hydrating','conflict','modal','draft']) assert.equal(canAutoRefreshCloud({...base,[field]:true}),false);
});

test('cambio de cuenta: respuestas asíncronas tardías no pisan estado ajeno',()=>{
  assert.match(app,/function hydrationBelongsToAccount\(uid,seq\)/);
  assert.match(app,/account\.user\?\.id===uid && app\.activeUid===uid/);
  assert.match(app,/const confirmed=await fetchCloudData\(\);\s*if\(!hydrationBelongsToAccount\(uid,seq\)\)return;/);
});
