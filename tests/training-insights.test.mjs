import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exerciseKey,previousExerciseSet,listTrackedExercises,exerciseHistory,sessionStats,nextPendingSet,restRemaining,restClock} from '../public/src/domain/training-insights.js';
const rows=[
 {id:'latest',type:'gym',date:'2026-11-06',setDetails:[
   {exerciseName:'Press de banca',setNumber:1,weight:42.5,reps:8,completed:true},
   {exerciseName:'Press de banca',setNumber:2,weight:40,reps:10,completed:true},
   {exerciseName:'Sentadilla',setNumber:1,weight:50,reps:7,completed:true}
 ]},
 {id:'older',type:'gym',date:'2026-11-02',setDetails:[
   {exerciseName:' PRESS   de banca ',setNumber:1,weight:40,reps:10,completed:true},
   {exerciseName:'Press de banca',setNumber:2,weight:30,reps:12,completed:true},
   {exerciseName:'Press de banca',setNumber:3,weight:35,reps:8,completed:false}
 ]},
 {id:'walk',type:'walk',date:'2026-11-07',setDetails:[{exerciseName:'Press de banca',setNumber:1,weight:999,reps:1,completed:true}]}
];
test('v1.6: normaliza nombre y consulta última serie realmente completada',()=>{
 assert.equal(exerciseKey('  PRESS   De BaNca '),'press de banca');
 assert.deepEqual(previousExerciseSet(rows,'press de banca',1),{weight:42.5,reps:8,date:'2026-11-06'});
 assert.deepEqual(previousExerciseSet(rows,'PRESS DE BANCA',2),{weight:40,reps:10,date:'2026-11-06'});
 assert.equal(previousExerciseSet(rows,'press de banca',3),null);
 assert.equal(previousExerciseSet([], 'press de banca',1),null);
});
test('v1.6: gráficos por ejercicio usan solamente sesiones de gimnasio y series confirmadas',()=>{
 assert.deepEqual(listTrackedExercises(rows),['Press de banca','Sentadilla']);
 const h=exerciseHistory(rows,'press de banca');
 assert.deepEqual(h.map(x=>[x.id,x.maxWeight,x.repsAtMax,x.volume,x.sets]),[
   ['older',40,10,760,2],['latest',42.5,8,740,2]
 ]);
 assert.equal(exerciseHistory(rows,'Ninguno').length,0);
 assert.equal(rows[0].setDetails[0].weight,42.5,'el cálculo no muta los datos');
});
test('v1.6: escritura de repeticiones sin confirmación NO suma series ni volumen',()=>{
 const draft={startedAt:1_000_000,snapshot:[{sets:2},{sets:1}],sets:{'0-0':{weight:40,reps:10,done:false},'0-1':{weight:42.5,reps:8,done:true}}};
 assert.deepEqual(sessionStats(draft,1_120_000),{completed:1,total:3,volume:340,minutes:2});
 assert.equal(nextPendingSet(draft),'0-0');
 draft.sets['0-0'].done=true;
 assert.equal(nextPendingSet(draft),'1-0');
 draft.sets['1-0']={weight:0,reps:12,done:true};
 assert.equal(nextPendingSet(draft),null);
});
test('v1.6: descanso calcula con reloj absoluto incluso después de background',()=>{
 assert.equal(restClock(180_000,90_000),'01:30');
 assert.equal(restRemaining(180_000,180_001),0);
 assert.equal(restClock(180_000,180_001),'00:00');
});
test('v1.6: input personalizado precede filtro y no se duplica abajo de biblioteca',()=>{
 const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
 const lib=app.slice(app.indexOf('function renderLibrary(){'),app.indexOf('function renderRoutine(){'));
 assert.ok(lib.indexOf('id="customexercise"')<lib.indexOf('id="libsearch"'));
 assert.ok(lib.indexOf('id="libsearch"')<lib.indexOf('class="card library-results"'));
 assert.equal((lib.match(/id="customexercise"/g)||[]).length,1);
 assert.match(app,/case 'usePreviousSet':/);
 assert.match(app,/case 'toggleRest':/);
 assert.match(app,/case 'confirmFinish':/);
 assert.match(app,/go\('sessionSummary'\)/);
 assert.match(app,/function renderStrengthEvolution\(/);
});
