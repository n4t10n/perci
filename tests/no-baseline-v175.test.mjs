import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyRemoteEntityDeletes} from '../public/src/data/offline-outbox.js';
import {reconcileCloudWithBaseline} from '../public/src/data/auto-hydration.js';

const clean=()=>({version:3,demo:false,onboardSeen:false,theme:'dark',focus:'both',routines:[],records:[],habits:[],checks:{},draft:null});

// Reproduce QA-B: navegador privado nuevo, cuenta sin actividad ni baseline.
test('v1.7.6: QA-B sin baseline no provoca TypeError en el reconciliador',()=>{
  const local=clean(),remote=clean();
  const mirror=applyRemoteEntityDeletes(null,local,remote);
  assert.deepEqual(mirror,{snapshot:local,removed:[],conflicts:[]});
  assert.equal(mirror.conflicts.length,0);
  const result=reconcileCloudWithBaseline(mirror.snapshot,remote,null);
  assert.equal(result.status,'empty-cloud');
});

test('v1.7.6: ausencia de baseline conserva exactamente el estado local',()=>{
  const local={...clean(),habits:[{id:'local-1',name:'Sin publicar',days:[]}]};
  const remote=clean();
  const mirror=applyRemoteEntityDeletes(null,local,remote);
  assert.strictEqual(mirror.snapshot,local);
  assert.equal(mirror.snapshot.habits[0].name,'Sin publicar');
  assert.deepEqual(mirror.removed,[]);
  assert.deepEqual(mirror.conflicts,[]);
});

test('v1.7.6: nueva cuenta sin registros puede iniciar la bienvenida',()=>{
  const local=clean(),remote=clean();
  const mirror=applyRemoteEntityDeletes(null,local,remote);
  const result=reconcileCloudWithBaseline(mirror.snapshot,remote,null);
  assert.equal(result.status,'empty-cloud');
  assert.equal(local.onboardSeen,false);
});

test('v1.7.6: el código de la PWA mantiene el tratamiento de cuentas existentes',()=>{
  const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
  assert.match(app,/const firstDeviceRestore=planFirstDeviceRestore\(/);
  assert.match(app,/const mirror=applyRemoteEntityDeletes\(baseline,state,remote\)/);
  assert.match(app,/if\(mirror\.conflicts\.length \|\| result\.status==='conflict'\)/);
});
