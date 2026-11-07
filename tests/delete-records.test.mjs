import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {queueSnapshot,readOutbox,saveBaseline,listRecordDeletes,markRecordDeleted,
  clearRecordDeletes,cancelRecordDelete,planOfflineSync,verifyRemoteSnapshot,
  applyRemoteRecordDeletes} from '../public/src/data/offline-outbox.js';
import {saveRecordDraft,listRecordDrafts,removeRecordDraft,findRecordDraft} from '../public/src/data/record-drafts.js';
const uid='123e4567-e89b-12d3-a456-426614174000';
const other='123e4567-e89b-12d3-a456-426614174001';
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
const empty=()=>({routines:[],records:[],habits:[],checks:{},draft:null,demo:false});
const rec=(id='x1')=>({id,type:'gym',name:'Prueba',date:'2026-11-06',minutes:1,setsDone:1,volume:100,note:'',setDetails:[{exercisePosition:0,exerciseName:'Sentadillas',setNumber:1,reps:10,weight:10,completed:true}]});
const base=()=>({...empty(),records:[rec()]});
test('borrado confirmado: intención persistente, sin reintroducir desde la nube',()=>{
  memory.clear();const before=base();saveBaseline(uid,before);
  markRecordDeleted(uid,'x1');queueSnapshot(uid,empty());
  const pending=readOutbox(uid);
  const plan=planOfflineSync(pending.base,pending.snapshot,before,null,listRecordDeletes(uid));
  assert.equal(plan.safe,true);
  assert.deepEqual(plan.deletions,[{kind:'records',id:'x1'}]);
  assert.equal(plan.snapshot.records.length,0);
  assert.equal(verifyRemoteSnapshot(plan.snapshot,before,plan.deletions),false);
  assert.equal(verifyRemoteSnapshot(plan.snapshot,empty(),plan.deletions),true);
  clearRecordDeletes(uid,['x1']);assert.deepEqual(listRecordDeletes(uid),[]);
});
test('migración: captura borrados de v1.2 aún guardados en outbox',()=>{
  memory.clear();const plan=planOfflineSync(base(),empty(),base());
  assert.deepEqual(plan.deletions,[{kind:'records',id:'x1'}]);
  assert.equal(plan.unsupportedDeletes.length,0);
});
test('sin baseline pero con intención explícita, el borrado no resucita',()=>{
  const plan=planOfflineSync(null,empty(),base(),null,['x1']);
  assert.deepEqual(plan.deletions,[{kind:'records',id:'x1'}]);
  assert.equal(plan.snapshot.records.length,0);
});
test('sin intención ni baseline, una nube más nueva no se borra',()=>{
  const plan=planOfflineSync(null,empty(),base());
  assert.equal(plan.snapshot.records.length,1);
  assert.equal(plan.deletions.length,0);
});
test('si otro dispositivo eliminó registro, no se recrea desde caché intacta',()=>{
  const old=base();const mirrored=applyRemoteRecordDeletes(old,old,empty());
  assert.deepEqual(mirrored.removed,['x1']);
  assert.equal(mirrored.snapshot.records.length,0);
  const edited=base();edited.records[0].minutes=25;
  assert.equal(applyRemoteRecordDeletes(old,edited,empty()).snapshot.records.length,1);
});
test('borradores de registro: por cuenta, se pueden restaurar y descartar',()=>{
  memory.clear();saveRecordDraft(uid,rec());
  assert.equal(listRecordDrafts(uid).length,1);
  assert.equal(findRecordDraft(uid,'x1').setDetails[0].weight,10);
  assert.equal(listRecordDrafts(other).length,0);
  removeRecordDraft(uid,'x1');assert.equal(listRecordDrafts(uid).length,0);
});
test('restaurar borrador antes de sincronizar cancela borrado pendiente',()=>{
  memory.clear();markRecordDeleted(uid,'x1');cancelRecordDelete(uid,'x1');
  assert.deepEqual(listRecordDeletes(uid),[]);
});
test('la interfaz pregunta antes de eliminar y no reabre cartel de borrados de registros',()=>{
  const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
  assert.match(app,/case 'saveAsRecordDraft'/);
  assert.match(app,/Eliminar definitivamente/);
  assert.match(app,/deleteCloudEntities/);
  assert.match(app,/renderSavedRecordDrafts/);
});

test('borrado ya aplicado en remoto no provoca conflicto ni resucita',()=>{
  const old=base();const plan=planOfflineSync(old,empty(),empty(),null,['x1']);
  assert.equal(plan.safe,true);
  assert.deepEqual(plan.deletions,[]);
  assert.deepEqual(plan.conflicts,[]);
  assert.deepEqual(plan.snapshot.records,[]);
});
test('el borrado online fuerza el envío y el estado online no muestra banners',()=>{
  const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
  const accountUI=fs.readFileSync(new URL('../public/src/account-ui.js',import.meta.url),'utf8');
  assert.match(app,/queueMicrotask\(\(\)=>hydrateCloud\(app.activeUid,\{silent:true\}\)\)/);
  assert.match(app,/window\.addEventListener\('focus',\(\)=>refreshConnectionAware\(\)\)/);
  assert.match(app,/const syncNotice=\(\)=>isOfflineNow\(account\)\?/);
  assert.match(app,/Cuenta conectada/);
  assert.match(accountUI,/const offlineText=offline\?/);
  assert.doesNotMatch(app,/Cambios pendientes de sincronizar<\/strong>/);
});
