import test from 'node:test';
import assert from 'node:assert/strict';
import {hasPersonalData,reconcileCloudSnapshot} from '../public/src/data/auto-hydration.js';
const routine=(name='Dia 1 Full Body',reps=10)=>({id:'fgyd1rw7',name,exercises:[{name:'Press de banca',sets:4,reps}]});
const snapshot=(routines=[],demo=false)=>({version:3,demo,theme:'dark',focus:'both',onboardSeen:false,routines,records:[],habits:[],checks:{},draft:null});
test('navegador privado: recupera automáticamente la rutina íntegra desde Supabase',()=>{
 const local=snapshot(),remote=snapshot([routine()]);
 const outcome=reconcileCloudSnapshot(local,remote);
 assert.equal(outcome.status,'restored');
 assert.deepEqual(outcome.snapshot.routines,[routine()]);
 assert.equal(outcome.snapshot.onboardSeen,true);
 assert.deepEqual(local.routines,[]);
});
test('no borra rutina local si la nube no tiene datos',()=>{
 const local=snapshot([routine()]); const result=reconcileCloudSnapshot(local,snapshot());
 assert.equal(result.status,'empty-cloud');assert.deepEqual(result.snapshot.routines,[routine()]);
});
test('mantiene datos locales y agrega IDs remotos no existentes',()=>{
 const local=snapshot([routine()]);
 const cloud=snapshot([routine(),{id:'r2',name:'Otro día',exercises:[]}]);
 const result=reconcileCloudSnapshot(local,cloud);
 assert.equal(result.status,'merged');assert.equal(result.snapshot.routines.length,2);
 assert.equal(result.snapshot.routines[0].id,'fgyd1rw7');
});
test('detecta el mismo ID modificado sin sobrescribir local ni remoto',()=>{
 const local=snapshot([routine('Día local')]);const cloud=snapshot([routine('Día nube')]);
 const outcome=reconcileCloudSnapshot(local,cloud);
 assert.equal(outcome.status,'conflict');assert.equal(outcome.snapshot,null);
 assert.equal(outcome.conflicts.length,1);
 assert.equal(local.routines[0].name,'Día local');assert.equal(cloud.routines[0].name,'Día nube');
 assert.equal(reconcileCloudSnapshot(local,cloud,'remote').snapshot.routines[0].name,'Día nube');
 assert.equal(reconcileCloudSnapshot(local,cloud,'local').snapshot.routines[0].name,'Día local');
});
test('descarta ejemplos de v0.4 sin perder la rutina real',()=>{
 const local={...snapshot([routine()],true),records:[{id:'s1',type:'walk',name:'Demo'}],habits:[{id:'h1',name:'Demo',days:[1]}]};
 assert.equal(hasPersonalData(local),true);
 const result=reconcileCloudSnapshot(local,snapshot([routine()]));
 assert.equal(result.snapshot.records.length,0);
 assert.equal(result.snapshot.habits.length,0);
 assert.equal(result.snapshot.routines.length,1);
});
test('reconciliación considera hábitos, checks y actividades',()=>{
 const local=snapshot(),remote={...snapshot(),routines:[],records:[{id:'s4',type:'walk',name:'Caminata',date:'2026-11-06',minutes:20,note:''}],habits:[{id:'h5',name:'Agua',days:[1],paused:false}],checks:{'h5:2026-11-06':true}};
 const result=reconcileCloudSnapshot(local,remote);
 assert.equal(result.status,'restored');assert.equal(result.snapshot.records.length,1);assert.equal(result.snapshot.habits.length,1);
 assert.equal(result.snapshot.checks['h5:2026-11-06'],true);
});
test('no acepta respuestas remotas inválidas ni IDs repetidos',()=>{
 assert.throws(()=>reconcileCloudSnapshot(snapshot(),{routines:[],records:[],habits:[]}),/formato/);
 assert.throws(()=>reconcileCloudSnapshot(snapshot(),snapshot([routine(),routine()])),/repetidos/);
});
