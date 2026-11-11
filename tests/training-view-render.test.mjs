import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previousExerciseSet,sessionStats,nextPendingSet,restRemaining,restClock,listTrackedExercises,exerciseHistory} from '../public/src/domain/training-insights.js';
import {getWorkoutDate} from '../public/src/domain/routine-session-tools.js';
import {dateISO} from '../public/src/domain/initial-state.js';
const source=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,value='',cls='')=>`<button data-action="${action}" data-value="${esc(value)}" class="btn ${cls}">${label}</button>`;
const back=()=>'<button>Volver</button>';
const record={id:'old',type:'gym',date:'2026-11-04',setDetails:[
 {exerciseName:'Press de banca',setNumber:1,weight:40,reps:10,completed:true},
 {exerciseName:'Press de banca',setNumber:2,weight:40,reps:9,completed:true}
]};
const sample={records:[record],draft:{id:'draft1',routineId:'r1',snapshot:[{name:'Press de banca',sets:3,reps:10}],startedAt:Date.now()-60000,sets:{'0-0':{weight:40,reps:10,done:false}},restEnabled:true,restSeconds:90,restUntil:Date.now()+90000},routines:[{id:'r1',name:'Torso A',exercises:[{name:'Press de banca',sets:3,reps:10}]}]};
const app={completedRecord:'old',progressExercise:''};
const account={offline:false};
const deps={state:sample,app,account,sessionStats,nextPendingSet,restRemaining,restClock,previousExerciseSet,listTrackedExercises,exerciseHistory,isOfflineNow:()=>false,getWorkoutDate,dateISO,h:esc,button,back,renderProgress:()=>'<p>Progress</p>'};
function getRenderer(name,fragment){
 const keys=Object.keys(deps),values=Object.values(deps);
 return new Function(...keys,`${fragment};return ${name};`)(...values);
}
const sessionCode=source.slice(source.indexOf('const asKg='),source.indexOf('function renderOtherForm(){'));
const renderSession=getRenderer('renderSession',sessionCode);
const renderSummary=getRenderer('renderSessionSummary',sessionCode);
const strengthCode=source.slice(source.indexOf('function renderStrengthEvolution(){'),source.indexOf('function renderProgress(){'));
const renderStrength=getRenderer('renderStrengthEvolution',`const asKg=value=>Number(value||0).toLocaleString('es-AR',{maximumFractionDigits:2});\n${strengthCode}`);
test('v1.6: HTML de sesión distingue serie escrita y confirmada y ofrece última vez',()=>{
 const html=renderSession();
 assert.match(html,/0 \/ 3 series confirmadas/);
 assert.match(html,/Última vez: 40 kg × 10 reps/);
 assert.match(html,/data-action="usePreviousSet"/);
 assert.match(html,/data-action="toggleRest"/);
 assert.match(html,/data-rest-clock/);
 assert.match(html,/Siguiente serie/);
 assert.match(html,/data-set="0-0"/);
 assert.match(html,/max="99999"/);
});
test('v1.6: render de progreso se activa solo con series realmente existentes',()=>{
 const html=renderStrength();
 assert.match(html,/Evolución por ejercicio/);
 assert.match(html,/<select id="progressExercise">/);
 assert.match(html,/Press de banca/);
 assert.match(html,/Con otra sesión/);
});
test('v1.6: resumen deriva de registro persistido y no de un draft inventado',()=>{
 sample.records.unshift({id:'new',type:'gym',name:'Torso A',date:'2026-11-06',minutes:38,setsDone:2,volume:725.5,
   setDetails:[{exerciseName:'Press de banca',setNumber:1,weight:42.5,reps:10,completed:true},{exerciseName:'Press de banca',setNumber:2,weight:30,reps:10,completed:true}]});
 app.completedRecord='new';
 const html=renderSummary();
 assert.match(html,/ENTRENAMIENTO GUARDADO/);
 assert.match(html,/725,5/);
 assert.match(html,/42,5 kg × 10 reps/);
 const progress=renderStrength();
 assert.match(progress,/<polyline/);
 assert.match(progress,/42,5 kg/);
});
