import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planOfflineSync,verifyRemoteSnapshot} from '../public/src/data/offline-outbox.js';
import {reconcileCloudSnapshot} from '../public/src/data/auto-hydration.js';
const empty=()=>({version:3,demo:false,routines:[],records:[],habits:[],checks:{},draft:null});
const habit={id:'habito_prueba',name:'Caminar',days:[1,2,3,4,5],paused:false};
test('v1.4.1: cuenta nueva conserva y transmite su primer hábito',()=>{
  const phone={...empty(),habits:[habit]};
  const plan=planOfflineSync(empty(),phone,empty());
  assert.equal(plan.safe,true);
  assert.equal(plan.snapshot.habits.length,1);
  assert.equal(verifyRemoteSnapshot(plan.snapshot,empty()),false);
  assert.equal(verifyRemoteSnapshot(plan.snapshot,{...empty(),habits:[habit]}),true);
  const mac=reconcileCloudSnapshot(empty(),{...empty(),habits:[habit]});
  assert.equal(mac.status,'restored');
  assert.equal(mac.snapshot.habits[0].name,'Caminar');
});
test('v1.4.1: al guardar hábito no se asegura éxito sin persistencia y se reconsulta nube',()=>{
  const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
  const handler=app.slice(app.indexOf("case 'saveHabit':"),app.indexOf("case 'pauseHabit':"));
  assert.match(handler,/if\(!save\(\)\)/);
  assert.match(handler,/state\.habits=previous/);
  assert.match(handler,/queueMicrotask\(/);
  assert.match(app,/hydrationRerunRequested=true/);
});
