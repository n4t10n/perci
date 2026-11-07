import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileCloudWithBaseline} from '../public/src/data/auto-hydration.js';

const routine=(name)=>({id:'routine-test',name,exercises:[{name:'Remo',sets:3,reps:10}]});
const snapshot=(name)=>({version:3,demo:false,onboardSeen:true,theme:'dark',focus:'both',
  routines:name?[routine(name)]:[],records:[],habits:[],checks:{},draft:null});

// Reproducción exacta del feedback real. La Mac terminó de guardar TEST MAC 2;
// el iPhone decidió conservar TEST IPHONE 2 después de detectar el conflicto.
test('v1.6.2: Mac sin ediciones pendientes recibe decisión del iPhone sin pedir otra vez',()=>{
 const baseline=snapshot('TEST MAC 2');
 const local=structuredClone(baseline);
 const remote=snapshot('TEST IPHONE 2');
 const result=reconcileCloudWithBaseline(local,remote,baseline);
 assert.equal(result.conflicts.length,0);
 assert.equal(result.status,'merged');
 assert.equal(result.snapshot.routines[0].name,'TEST IPHONE 2');
 assert.equal(local.routines[0].name,'TEST MAC 2');
});
test('v1.6.2: cambios en los dos lados siguen exigiendo decisión',()=>{
 const baseline=snapshot('TEST');
 const local=snapshot('TEST MAC');
 const remote=snapshot('TEST IPHONE');
 const result=reconcileCloudWithBaseline(local,remote,baseline);
 assert.equal(result.status,'conflict');
 assert.equal(result.conflicts.length,1);
 assert.equal(result.snapshot,null);
 assert.equal(reconcileCloudWithBaseline(local,remote,baseline,'remote').snapshot.routines[0].name,'TEST IPHONE');
 assert.equal(reconcileCloudWithBaseline(local,remote,baseline,'local').snapshot.routines[0].name,'TEST MAC');
});
test('v1.6.2: otro dispositivo agrega un registro; el equipo en reposo lo acepta',()=>{
 const baseline=snapshot('TEST');
 const remote=structuredClone(baseline);
 remote.habits=[{id:'h1',name:'Dormir 8 horas',days:[1,2,3],paused:false}];
 const result=reconcileCloudWithBaseline(structuredClone(baseline),remote,baseline);
 assert.equal(result.conflicts.length,0);
 assert.equal(result.snapshot.habits[0].name,'Dormir 8 horas');
});
test('v1.6.2: si nunca se guardó un baseline, dos versiones diferentes sí requieren confirmación',()=>{
 assert.equal(reconcileCloudWithBaseline(snapshot('LOCAL'),snapshot('NUBE')).status,'conflict');
});
test('v1.6.2: referencia vacía y nube vacía permiten recuperar datos locales iniciales',()=>{
 const result=reconcileCloudWithBaseline(snapshot('LOCAL'),snapshot(),snapshot());
 assert.equal(result.status,'empty-cloud');
 assert.equal(result.snapshot.routines[0].name,'LOCAL');
});
test('v1.6.2: borrado remoto se refleja en una copia intacta sin resucitar la rutina',()=>{
 const base=snapshot('TEST');
 const result=reconcileCloudWithBaseline(structuredClone(base),snapshot(),base);
 assert.equal(result.status,'merged');
 assert.deepEqual(result.snapshot.routines,[]);
});
test('v1.6.2: app integra comparación con baseline también al resolver un conflicto verdadero',()=>{
 const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
 assert.match(app,/const baseline=getBaseline\(uid\);\s*const mirror=applyRemoteEntityDeletes\(baseline,state,remote\);/);
 assert.match(app,/reconcileCloudWithBaseline\(mirror\.snapshot,remote,baseline\)/);
 assert.match(app,/kind:'initial',base:baseline/);
 assert.match(app,/reconcileCloudWithBaseline\(conflict\.local,conflict\.remote,conflict\.base,prefer\)/);
});
