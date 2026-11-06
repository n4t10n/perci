import test from 'node:test';
import assert from 'node:assert/strict';
import {previewLocalMigration,clientId} from '../public/src/data/migration-preflight.js';

const valid = () => ({version:2,demo:false,routines:[{id:'abc',name:'Torso',exercises:[{name:'Press',sets:3,reps:10}]}],records:[{id:'reg1',type:'walk',name:'Caminata',minutes:40,date:'2026-11-05'}],habits:[{id:'h1',name:'Hidratarme',days:[1,3,5]}],checks:{'h1:2026-11-05':true},draft:null});

test('reconoce snapshot de rutinas creadas y datos complementarios',()=>{
  const report=previewLocalMigration(valid());
  assert.equal(report.ready,true);
  assert.deepEqual(report.counts,{routines:1,exercises:1,records:1,habits:1,completions:1,drafts:0});
});
test('alerta demo mezclada con rutinas del usuario',()=>{
  const snapshot=valid();snapshot.demo=true;
  const report=previewLocalMigration(snapshot);
  assert.equal(report.ready,true);
  assert.ok(report.warnings.some(w=>w.includes('demostración')));
});
test('impide datos inválidos y referencias huérfanas de checks',()=>{
  const snapshot=valid();snapshot.routines[0].exercises[0].sets=0;
  snapshot.checks['missing:2026-11-05']=true;
  snapshot.records[0].date='2026-02-30';
  const report=previewLocalMigration(snapshot);
  assert.equal(report.ready,false);
  assert.ok(report.errors.length>=3);
});
test('IDs legados no se confunden con UUID y son estables',()=>{
  assert.equal(clientId('routine','r1'),'perci-v04:routine:r1');
  assert.equal(clientId('routine','r1'),clientId('routine','r1'));
});
test('no muta el snapshot original',()=>{
  const snapshot=valid(),before=JSON.stringify(snapshot);
  previewLocalMigration(snapshot);
  assert.equal(JSON.stringify(snapshot),before);
});
