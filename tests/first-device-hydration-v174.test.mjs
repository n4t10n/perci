import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planFirstDeviceRestore} from '../public/src/data/first-device-hydration.js';
const local=()=>({version:3,demo:false,onboardSeen:false,theme:'dark',focus:'both',routines:[],records:[],habits:[],checks:{},draft:null});
const remote=()=>({revision:7,onboardSeen:true,theme:'light',focus:'gym',routines:[{id:'r-qa',name:'QA',exercises:[{name:'Sentadilla',sets:3,reps:10}]}],records:[],habits:[],checks:{}});
test('v1.7.6: un navegador nuevo restaura rutina y preferencias desde nube',()=>{
 const data=remote();const saved=planFirstDeviceRestore({local:local(),remote:data});
 assert.equal(saved.onboardSeen,true);
 assert.equal(saved.theme,'light');assert.equal(saved.focus,'gym');
 assert.equal(saved.routines[0].exercises[0].sets,3);
 assert.equal(saved.demo,false);assert.equal(saved.draft,null);
 saved.routines[0].name='local';assert.equal(data.routines[0].name,'QA');
});
test('v1.7.6: una cuenta que completo bienvenida pero no tiene rutinas no vuelve a verla',()=>{
 const data={...remote(),routines:[]};
 assert.equal(planFirstDeviceRestore({local:local(),remote:data}).onboardSeen,true);
});
test('v1.7.6: una cuenta realmente nueva sigue mostrando bienvenida',()=>{
 assert.equal(planFirstDeviceRestore({local:local(),remote:{...remote(),routines:[],onboardSeen:false}}),null);
});
test('v1.7.6: no sobreescribir datos locales o ediciones sin sincronizar',()=>{
 const own=local();own.habits=[{id:'mi-habito',name:'Agua'}];
 assert.equal(planFirstDeviceRestore({local:own,remote:remote()}),null);
 assert.equal(planFirstDeviceRestore({local:local(),remote:remote(),pending:{revision:1}}),null);
 const draft=local();draft.draft={routineId:'r-local'};
 assert.equal(planFirstDeviceRestore({local:draft,remote:remote()}),null);
 assert.equal(planFirstDeviceRestore({local:local(),remote:remote(),deleteIntents:{routines:['r-qa']}}),null);
});
test('v1.7.6: no restaurar respuesta remota inválida',()=>{
 assert.equal(planFirstDeviceRestore({local:local(),remote:{...remote(),routines:'bad'}}),null);
 assert.equal(planFirstDeviceRestore({local:local(),remote:{...remote(),routines:[{id:'bad'}]}}),null);
});
test('v1.7.6: la lectura inicial se ejecuta antes del reconciliador y no requiere un click',()=>{
 const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
 assert.match(app,/const firstDeviceRestore=planFirstDeviceRestore\(/);
 assert.match(app,/state=firstDeviceRestore/);
 assert.match(app,/if\(\(recovered\|\|onlineSessionStarted\)\&\&account\.authenticated/);
 assert.match(app,/hydrateCloud\(account\.user\.id\)/);
 assert.match(app,/if\(account\.syncFailed && app\.view==='onboard'\)/);
});
