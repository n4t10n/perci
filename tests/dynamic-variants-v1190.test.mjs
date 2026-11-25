import test from 'node:test';
import assert from 'node:assert/strict';
import {exerciseVariants,customVariantId,setCustomVariant,mergeVariantRegistry,variantLabel,sessionExerciseSnapshot} from '../public/src/domain/exercise-context.js';
import {previousExerciseSet,exerciseHistory} from '../public/src/domain/training-insights.js';
import {planOfflineSync,verifyRemoteSnapshot} from '../public/src/data/offline-outbox.js';
import {planFirstDeviceRestore} from '../public/src/data/first-device-hydration.js';
const blank=()=>({routines:[],records:[],habits:[],checks:{},demo:false,onboardSeen:true});
test('real routine names get compatible variants; combination stays fixed',()=>{
 for(const name of ['Sillón de Cuadriceps','Remo inclinado','Prensa maquina','Remo sentado','Apertura en maquina','Press militar con mancuernas','Femorales sentado','Femorales en camilla','Press inclinado con mancuernas','Jalón al pecho'])assert.ok(exerciseVariants(name).length>0,name);
 assert.deepEqual(exerciseVariants('Curl de bíceps + Press militar'),[]);
});
test('custom option is stable across alias, routines, archive and restoration',()=>{
 const id=customVariantId('Barra olímpica');assert.equal(id,'custom:barra olimpica');assert.equal(customVariantId('Máquina'),'');assert.equal(customVariantId('<script>'),'');
 const r=setCustomVariant([], 'Press banca',id,true);assert.ok(exerciseVariants('Press de banca',r).includes(id));assert.equal(variantLabel(id),'Barra olimpica');
 const archived=setCustomVariant(r,'Press de banca',id,false);assert.ok(!exerciseVariants('Press banca',archived).includes(id));assert.equal(variantLabel(id),'Barra olimpica');
 assert.deepEqual(mergeVariantRegistry(r,archived,r),archived);assert.deepEqual(mergeVariantRegistry(archived,r,archived),r);
 assert.equal(sessionExerciseSnapshot([{name:'Press banca',defaultVariant:id}],[],archived)[0].variant,id);
});
test('two devices merge distinct additions and verify round trip',()=>{
 const a=setCustomVariant([],'Remo sentado',customVariantId('Agarre D'),true),b=setCustomVariant([],'Hip thrust',customVariantId('Banda'),true);
 const merged=planOfflineSync(blank(),{...blank(),customVariants:a},{...blank(),customVariants:b});
 assert.equal(merged.safe,true);assert.equal(merged.snapshot.customVariants.length,2);assert.equal(verifyRemoteSnapshot(merged.snapshot,{...blank(),customVariants:b}),false);
 assert.equal(verifyRemoteSnapshot(merged.snapshot,structuredClone(merged.snapshot)),true);
 const restored=planFirstDeviceRestore({local:blank(),remote:merged.snapshot});assert.equal(restored.customVariants.length,2);
});
test('custom variant history never mixes with unknown or builtin',()=>{
 const id=customVariantId('Banco especial'),name='Press banca';const rec=(variant,weight)=>({type:'gym',date:'2026-11-25',setDetails:[{exerciseName:name,variant,weight,reps:10,setNumber:1,completed:true}]});
 const records=[rec(id,15),rec('barra',40),rec(undefined,50)];assert.equal(previousExerciseSet(records,name,1,id).weight,15);assert.equal(previousExerciseSet(records,name,1).weight,50);assert.equal(exerciseHistory(records,name+' · Banco especial')[0].maxWeight,15);
});
