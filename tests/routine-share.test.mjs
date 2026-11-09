import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSharedRoutine,isValidShareCode,routineTemplateIsEqual} from '../public/src/domain/routine-share.js';

test('código de 64 bits y formato válido',()=>{
  assert.equal(isValidShareCode('PERC-AbcdEfgh0123_-Zq'),true);
  assert.equal(isValidShareCode('PERC-123'),false);
  assert.equal(isValidShareCode('PERC-AbcdEfgh0123_-Zq#'),false);
});
test('comparte solo nombre y plan de ejercicios, nunca historia ni datos de cuenta',()=>{
  const out=cleanSharedRoutine({id:'owner',user_id:'sensitive',name:' Pecho ',
    records:[{weight:100}],exercises:[{name:' Press banca ',sets:4,reps:8,id:'private',weight:100}]});
  assert.deepEqual(out,{name:'Pecho',exercises:[{name:'Press banca',sets:4,reps:8}]});
  assert.equal(JSON.stringify(out).includes('owner'),false);
  assert.equal(JSON.stringify(out).includes('weight'),false);
});
test('rechaza cargas inválidas y protege del contenido extra',()=>{
  for(const input of [null,{}, {name:'x',exercises:[]}, {name:'x',exercises:[{name:'a',sets:0,reps:10}]},
    {name:'x',exercises:[{name:'a',sets:3,reps:'10'}]},
    {name:'x',exercises:[{name:'',sets:3,reps:10}]},
    {name:'x',exercises:new Array(41).fill({name:'a',sets:3,reps:10})}]){
    assert.throws(()=>cleanSharedRoutine(input));
  }
});
test('detecta misma rutina sin depender de ID del usuario',()=>{
  const template={name:'Pecho',exercises:[{name:'Press',sets:3,reps:10}]};
  assert.equal(routineTemplateIsEqual({...template,id:'a'},{...template,id:'b'}),true);
  assert.equal(routineTemplateIsEqual(template,{...template,name:'Otra'}),false);
});
