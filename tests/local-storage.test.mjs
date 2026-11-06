import test from 'node:test';
import assert from 'node:assert/strict';
import {storage,STORAGE_KEY,PRE_B2_CHECKPOINT_KEY} from '../public/src/data/repository.js';

const previous = globalThis.localStorage;
class LocalStorageMock {
  items=new Map();
  getItem(key){return this.items.has(key)?this.items.get(key):null;}
  setItem(key,value){this.items.set(key,String(value));}
  removeItem(key){this.items.delete(key);}
}
test('preserva la rutina de v0.5 y toma checkpoint en primera lectura',()=>{
  globalThis.localStorage=new LocalStorageMock();
  const snapshot={version:2,routines:[{id:'mi-rutina',name:'Primera rutina real',exercises:[]}],records:[],habits:[]};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot));
  assert.deepEqual(storage.read(),snapshot);
  assert.equal(localStorage.getItem(PRE_B2_CHECKPOINT_KEY),JSON.stringify(snapshot));
  storage.write({...snapshot,routines:[]});
  assert.equal(JSON.parse(localStorage.getItem(PRE_B2_CHECKPOINT_KEY)).routines.length,1);
  assert.equal(storage.read().routines.length,0);
  globalThis.localStorage=previous;
});
