import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {queueSnapshot,readOutbox,clearOutboxIfCurrent,saveBaseline,getBaseline,
  readRoutineEditor,saveRoutineEditor,clearRoutineEditor,planOfflineSync,verifyRemoteSnapshot,
  rebaseOutbox,isOfflineNow} from '../public/src/data/offline-outbox.js';
const uid1='123e4567-e89b-12d3-a456-426614174000';
const uid2='123e4567-e89b-12d3-a456-426614174001';
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.has(k)?memory.get(k):null,
  setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
const blank=()=>({version:3,demo:false,routines:[],records:[],habits:[],checks:{},draft:null});
const routine=(id,name='Día 1 Full Body',reps=10)=>({id,name,exercises:[{name:'Press de banca',sets:4,reps}]});
const activity=(id)=>({id,type:'gym',name:'Entrenamiento',date:'2026-11-06',minutes:25,setsDone:8,volume:1400,note:''});
function reset(){memory.clear()}

test('v1.2: el borrador local sobrevive una recarga y no se comparte entre cuentas',()=>{
  reset();saveRoutineEditor(uid1,{id:null,name:'Tren superior',exercises:[{name:'Remo',sets:4,reps:10}]});
  assert.equal(readRoutineEditor(uid1)?.name,'Tren superior');
  assert.equal(readRoutineEditor(uid2),null);
  clearRoutineEditor(uid1);assert.equal(readRoutineEditor(uid1),null);
});
test('v1.2: guarda borrador de sesión con series sin finalizar y mantiene revisión pendiente',()=>{
  reset();const base={...blank(),routines:[routine('r1')]};saveBaseline(uid1,base);
  const draft={...base,draft:{id:'d1',routineId:'r1',startedAt:1,sets:{'0-0':{weight:35,reps:10,done:false}}}};
  const first=queueSnapshot(uid1,draft);const next=readOutbox(uid1);
  assert.equal(next.snapshot.draft.sets['0-0'].weight,35);
  assert.equal(first.revision,1);
  assert.deepEqual(next.base,base);
});
test('v1.2: el chequeo de versión impide perder cambios hechos durante una sincronización',()=>{
  reset();saveBaseline(uid1,blank());const a=queueSnapshot(uid1,{...blank(),routines:[routine('r1')]});
  queueSnapshot(uid1,{...blank(),routines:[routine('r1'),routine('r2')]});
  assert.equal(clearOutboxIfCurrent(uid1,a.revision),false);
  assert.equal(readOutbox(uid1).snapshot.routines.length,2);
  assert.equal(clearOutboxIfCurrent(uid1,2),true);
  assert.equal(readOutbox(uid1),null);
});
test('v1.2: conserva elementos agregados en nube y local offline sin duplicarlos',()=>{
  const base={...blank(),routines:[routine('r1')]};
  const local={...base,routines:[routine('r1'),routine('r2')]};
  const remote={...base,routines:[routine('r1'),routine('r3')]};
  const plan=planOfflineSync(base,local,remote);
  assert.equal(plan.safe,true);
  assert.deepEqual(plan.snapshot.routines.map(r=>r.id),['r1','r2','r3']);
  assert.equal(verifyRemoteSnapshot(plan.snapshot,plan.snapshot),true);
});
test('v1.2: edición local offline con remoto sin cambios se sincroniza',()=>{
  const base={...blank(),routines:[routine('r1')]};
  const local={...base,routines:[routine('r1','Día 1 Full Body',12)]};
  const plan=planOfflineSync(base,local,base);
  assert.equal(plan.safe,true);
  assert.equal(plan.snapshot.routines[0].exercises[0].reps,12);
});
test('v1.2: cambios en ambas copias del mismo ejercicio requieren decisión',()=>{
  const base={...blank(),routines:[routine('r1')]};
  const local={...base,routines:[routine('r1','Día 1 Full Body',12)]};
  const remote={...base,routines:[routine('r1','Día 1 Full Body',8)]};
  assert.equal(planOfflineSync(base,local,remote).safe,false);
  assert.equal(planOfflineSync(base,local,remote).conflicts.length,1);
  assert.equal(planOfflineSync(base,local,remote,'remote').snapshot.routines[0].exercises[0].reps,8);
  assert.equal(planOfflineSync(base,local,remote,'local').snapshot.routines[0].exercises[0].reps,12);
});
test('v1.2: un borrado pendiente no se anuncia como sincronizado',()=>{
  const base={...blank(),routines:[routine('r1')]};
  const local=blank();const result=planOfflineSync(base,local,base);
  assert.equal(result.safe,false);
  assert.equal(result.unsupportedDeletes[0].kind,'routines');
});
test('v1.2: desmarcar hábito offline no se pierde como borrado implícito',()=>{
  const base={...blank(),checks:{'h1:2026-11-06':true}};
  const result=planOfflineSync(base,{...base,checks:{}},base);
  assert.equal(result.safe,false);
  assert.equal(result.unsupportedDeletes.length,1);
  const resolved=planOfflineSync(base,{...base,checks:{}},base,'remote');
  assert.equal(resolved.safe,true);
  assert.equal(resolved.snapshot.checks['h1:2026-11-06'],true);
});
test('v1.2: una cuenta no puede leer los borradores de otra',()=>{
  reset();queueSnapshot(uid1,{...blank(),routines:[routine('r1')]});
  assert.equal(readOutbox(uid2),null);
  assert.equal(getBaseline(uid2),null);
});
test('v1.2: la rebase de conflictos no pierde el borrador ni la revisión',()=>{
  reset();const base=blank();saveBaseline(uid1,base);
  const first=queueSnapshot(uid1,{...base,records:[activity('s1')]});
  const updated={...base,records:[activity('s1'),activity('s2')]};
  const rebase=rebaseOutbox(uid1,updated,updated);
  assert.equal(rebase.revision,first.revision+1);
  assert.equal(rebase.base.records.length,2);
  assert.equal(readOutbox(uid1).snapshot.records.length,2);
});
test('v1.2: verificación remota detecta series cambiadas o registros faltantes',()=>{
  const expected={...blank(),routines:[routine('r1')],records:[activity('s1')]};
  assert.equal(verifyRemoteSnapshot(expected,{...blank(),routines:[routine('r1')]}),false);
  assert.equal(verifyRemoteSnapshot(expected,{...blank(),routines:[routine('r1','Día 1 Full Body',12)],records:[activity('s1')]}),false);
  assert.equal(verifyRemoteSnapshot(expected,expected),true);
});
test('v1.2: indicador offline respeta navigator.onLine y la sesión',()=>{
  const original=globalThis.navigator;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  assert.equal(isOfflineNow({offline:false}),true);
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
  assert.equal(isOfflineNow({offline:true}),true);
  assert.equal(isOfflineNow({offline:false}),false);
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:original});
});
test('v1.2: interfaz ofrece borrador antes de editar o entrenar y centra la recuperación',()=>{
  const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../public/src/styles.css',import.meta.url),'utf8');
  assert.match(app,/case 'beginOfflineSession'/);
  assert.match(app,/case 'beginOfflineRoutine'/);
  assert.match(app,/case 'resumeRoutineDraft'/);
  assert.match(app,/saveRoutineEditor/);
  assert.match(css,/\.sync-loading p\{[^}]*text-align:center/);
  assert.match(css,/\.offline-alert/);
});

test('v1.2: diferencias de peso por serie también generan conflicto y lectura posterior verificable',()=>{
  const base={...blank(),records:[{...activity('s1'),setDetails:[{exercisePosition:0,exerciseName:'Press de banca',setNumber:1,reps:10,weight:30,completed:true}]}]};
  const local=structuredClone(base);local.records[0].setDetails[0].weight=35;
  const remote=structuredClone(base);remote.records[0].setDetails[0].weight=40;
  assert.equal(planOfflineSync(base,local,remote).safe,false);
  assert.equal(verifyRemoteSnapshot(local,remote),false);
  assert.equal(planOfflineSync(base,local,base).safe,true);
});
