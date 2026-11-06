import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  listEntityDeletes,markEntityDeleted,clearEntityDeletes,cancelEntityDelete,allDeleteIntents,
  planOfflineSync,verifyRemoteSnapshot,applyRemoteEntityDeletes,queueSnapshot,readOutbox
} from '../public/src/data/offline-outbox.js';
const uidA='123e4567-e89b-12d3-a456-426614174000';
const uidB='123e4567-e89b-12d3-a456-426614174001';
const m=new Map();
globalThis.localStorage={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};
const blank=()=>({routines:[],records:[],habits:[],checks:{},demo:false,draft:null});
const rt=(id,sets=3)=>({id,name:'Test',exercises:[{name:'Press',sets,reps:10}]});
const habit=(id,name='Agua')=>({id,name,days:[1,3,5],paused:false});
const record=(id)=>({id,name:'Sesión antigua',type:'gym',minutes:12,date:'2026-11-06'});
const baseline=()=>({...blank(),routines:[rt('r1')],habits:[habit('h1')],checks:{'h1:2026-11-06':true},records:[record('s1')]});
test('v1.4: intenciones de borrado aisladas por cuenta y persistentes',()=>{
  m.clear();markEntityDeleted(uidA,'routines','r1');markEntityDeleted(uidA,'habits','h1');
  assert.deepEqual(listEntityDeletes(uidB),{routines:[],habits:[]});
  assert.deepEqual(listEntityDeletes(uidA),{routines:['r1'],habits:['h1']});
  assert.deepEqual(allDeleteIntents(uidA).records,[]);
  markEntityDeleted(uidA,'routines','r1');assert.equal(listEntityDeletes(uidA).routines.length,1);
  clearEntityDeletes(uidA,{routines:['r1']});assert.deepEqual(listEntityDeletes(uidA),{routines:[],habits:['h1']});
  cancelEntityDelete(uidA,'habits','h1');assert.deepEqual(listEntityDeletes(uidA),{routines:[],habits:[]});
});
test('v1.4: eliminar rutina no elimina registros históricos',()=>{
  const base=baseline();const local={...base,routines:[]};
  const out=planOfflineSync(base,local,base,null,[],{routines:['r1'],habits:[]});
  assert.equal(out.safe,true);
  assert.deepEqual(out.deletions,[{kind:'routines',id:'r1'}]);
  assert.deepEqual(out.snapshot.routines,[]);
  assert.equal(out.snapshot.records[0].id,'s1');
  assert.equal(verifyRemoteSnapshot(out.snapshot,out.snapshot,out.deletions),true);
  assert.equal(verifyRemoteSnapshot(out.snapshot,base,out.deletions),false);
});
test('v1.4: eliminar hábito también elimina sus comprobaciones de calendario',()=>{
  const base=baseline();const local={...base,habits:[],checks:{}};
  const out=planOfflineSync(base,local,base,null,[],{routines:[],habits:['h1']});
  assert.equal(out.safe,true);
  assert.deepEqual(out.deletions,[{kind:'habits',id:'h1'}]);
  assert.deepEqual(out.snapshot.habits,[]);
  assert.deepEqual(out.snapshot.checks,{});
});
test('v1.4: edición remota concurrente de una rutina que borré necesita decisión',()=>{
  const base=baseline();const local={...base,routines:[]};
  const remote={...base,routines:[rt('r1',5)]};
  const paused=planOfflineSync(base,local,remote,null,[],{routines:['r1']});
  assert.equal(paused.safe,false);assert.equal(paused.conflicts[0].reason,'delete-vs-edit');
  const keepRemote=planOfflineSync(base,local,remote,'remote',[],{routines:['r1']});
  assert.equal(keepRemote.snapshot.routines[0].exercises[0].sets,5);
  const deleteAnyway=planOfflineSync(base,local,remote,'local',[],{routines:['r1']});
  assert.deepEqual(deleteAnyway.deletions,[{kind:'routines',id:'r1'}]);
});
test('v1.4: otro dispositivo descarta una rutina/hábito borrado si su copia local está intacta',()=>{
  const before=baseline();const remote={...before,routines:[],habits:[],checks:{}};
  const result=applyRemoteEntityDeletes(before,before,remote);
  assert.deepEqual(result.snapshot.routines,[]);
  assert.deepEqual(result.snapshot.habits,[]);
  assert.deepEqual(result.snapshot.checks,{});
  assert.equal(result.snapshot.records[0].id,'s1');
});
test('v1.4: no desaparece silenciosamente la edición local de una rutina borrada remoto',()=>{
  const before=baseline();const local={...before,routines:[rt('r1',5)]};
  const remote={...before,routines:[]};
  const result=applyRemoteEntityDeletes(before,local,remote);
  assert.equal(result.snapshot.routines[0].exercises[0].sets,5);
  const decision=planOfflineSync(before,local,remote);
  assert.equal(decision.safe,false);
  assert.equal(decision.conflicts[0].kind,'routines');
});
test('v1.4: borrados sin conexión sobreviven cierre y mantienen la cola previa',()=>{
  m.clear();const local={...blank(),routines:[]};
  markEntityDeleted(uidA,'routines','r1');queueSnapshot(uidA,local);
  assert.equal(readOutbox(uidA).revision,1);
  assert.deepEqual(listEntityDeletes(uidA).routines,['r1']);
});
test('v1.4: la UI confirma antes de borrar y envía entidades con la cuenta autenticada',()=>{
  const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
  const api=fs.readFileSync(new URL('../api/shared.py',import.meta.url),'utf8');
  assert.match(app,/case 'confirmDeleteRoutine':deletePersonalEntity\('routines',value\)/);
  assert.match(app,/case 'confirmDeleteHabit':deletePersonalEntity\('habits',value\)/);
  assert.match(app,/deleteCloudEntities/);
  assert.match(api,/core\.delete_cloud_entities\(body, token, user\['id'\]\)/);
});

test('v1.4: conflicto si otro dispositivo completó el hábito antes del borrado local',()=>{
  const base={...baseline(),checks:{}};
  const local={...base,habits:[],checks:{}};
  const remote={...base,checks:{'h1:2026-11-06':true}};
  const out=planOfflineSync(base,local,remote,null,[],{habits:['h1']});
  assert.equal(out.safe,false);
  assert.equal(out.conflicts[0].reason,'delete-vs-edit');
});
test('v1.4: no ignorar completados locales nuevos si otro dispositivo borró el hábito',()=>{
  const base={...baseline(),checks:{}};
  const local={...base,checks:{'h1:2026-11-06':true}};
  const remote={...base,habits:[],checks:{}};
  const out=applyRemoteEntityDeletes(base,local,remote);
  assert.equal(out.conflicts.length,1);
  assert.equal(out.conflicts[0].reason,'remote-habit-delete-vs-local-check');
});
