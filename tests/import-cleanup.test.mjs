import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanImportedState} from '../public/src/data/import-cleanup.js';
const demo={demo:true,version:2,routines:[{id:'r1'},{id:'fgyd1rw7',name:'Dia 1 Full Body'}],records:[{id:'s1'}],habits:[{id:'h1'},{id:'h2'}],checks:{'h1:2026-11-04':true}};
test('al importar respaldo demo, conserva rutina real y excluye ilustraciones',()=>{
  const result=cleanImportedState(demo);
  assert.deepEqual(result.routines,[{id:'fgyd1rw7',name:'Dia 1 Full Body'}]);
  assert.equal(result.records.length,0);
  assert.equal(result.habits.length,0);
  assert.deepEqual(result.checks,{});
  assert.equal(result.demo,false);
});
test('nunca limpia respaldo personal si demo=false',()=>{
  const real={...demo,demo:false};
  assert.strictEqual(cleanImportedState(real),real);
});
