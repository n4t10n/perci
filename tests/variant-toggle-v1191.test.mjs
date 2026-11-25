import test from 'node:test';
import assert from 'node:assert/strict';
import {variantsEnabled,exerciseVariants,sessionExerciseSnapshot,customVariantId,setCustomVariant} from '../public/src/domain/exercise-context.js';
import {planOfflineSync,verifyRemoteSnapshot} from '../public/src/data/offline-outbox.js';
const names=['Sillón de Cuadriceps','Remo inclinado','Curl de bíceps + Press militar','Prensa maquina','Remo sentado','Apertura en maquina'];
test('the six routine exercises default to off; catalog stays available',()=>{
 for(const name of names){assert.equal(variantsEnabled({name}),false,name);assert.equal(variantsEnabled({name,variantsEnabled:true}),true);}
 assert.ok(exerciseVariants('Remo inclinado').includes('barra'));assert.equal(variantsEnabled({name:'Hip thrust'}),true);assert.equal(variantsEnabled({name:'Aductores en máquina'}),true);
});
test('disabled session has no variant; reenable restores the saved default without mutating history',()=>{
 const item={name:'Remo inclinado',defaultVariant:'barra',sets:3,reps:10,variantsEnabled:false};
 const old=[{type:'gym',date:'2026-11-25',setDetails:[{exerciseName:item.name,variant:'barra',completed:true}]}];
 const disabled=sessionExerciseSnapshot([item],old)[0];assert.equal(disabled.variantsEnabled,false);assert.equal(disabled.variant,undefined);assert.equal(item.defaultVariant,'barra');assert.equal(old[0].setDetails[0].variant,'barra');
 const enabled=sessionExerciseSnapshot([{...item,variantsEnabled:true}],old)[0];assert.equal(enabled.variant,'barra');
 const registry=setCustomVariant([], 'Mi ejercicio',customVariantId('Banda azul'),true);assert.equal(variantsEnabled({name:'Mi ejercicio'},registry),true);assert.equal(variantsEnabled({name:'Mi ejercicio',variantsEnabled:false},registry),false);
});
test('sync distinguishes absent, explicit false and true, preserves per-routine configuration',()=>{
 const blank={routines:[{id:'a',name:'A',exercises:[{name:'Remo inclinado',sets:2,reps:10}]},{id:'b',name:'B',exercises:[{name:'Remo inclinado',sets:2,reps:10}]}],records:[],habits:[],checks:{}};
 const local=structuredClone(blank);local.routines[0].exercises[0].variantsEnabled=true;
 const remote=structuredClone(blank);remote.routines[1].exercises[0].variantsEnabled=false;
 const merged=planOfflineSync(blank,local,remote);assert.equal(merged.safe,true);assert.equal(merged.snapshot.routines.find(r=>r.id==='a').exercises[0].variantsEnabled,true);assert.equal(merged.snapshot.routines.find(r=>r.id==='b').exercises[0].variantsEnabled,false);
 assert.equal(verifyRemoteSnapshot(merged.snapshot,blank),false);assert.equal(verifyRemoteSnapshot(merged.snapshot,structuredClone(merged.snapshot)),true);
});
