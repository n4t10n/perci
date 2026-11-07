import test from 'node:test';
import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
globalThis.window={addEventListener(){}};
const {account,onSyncRequested,scheduleAccountSync}=await import('../public/src/account.js?v=1.6');
const uid='123e4567-e89b-12d3-a456-426614174000';
const blank=()=>({version:3,demo:false,routines:[],records:[],habits:[],checks:{},draft:null});
test('v1.4.1: fallo previo puede reintentarse al crear hábito de cuenta nueva',async()=>{
 let calls=0;
 onSyncRequested(()=>calls++);
 Object.assign(account,{authenticated:true,offline:false,user:{id:uid},syncPaused:true,syncFailed:true,busy:false});
 scheduleAccountSync({...blank(),habits:[{id:'habit1',name:'Caminar',days:[0,1,2],paused:false}]});
 await new Promise(resolve=>setTimeout(resolve,1450));
 assert.equal(calls,1);
});
test('v1.4.1: pausa deliberada por conflicto no se ignora',async()=>{
 let calls=0;
 onSyncRequested(()=>calls++);
 Object.assign(account,{authenticated:true,offline:false,user:{id:uid},syncPaused:true,syncFailed:false,busy:false});
 scheduleAccountSync({...blank(),habits:[{id:'habit2',name:'Estirar',days:[1],paused:false}]});
 await new Promise(resolve=>setTimeout(resolve,1400));
 assert.equal(calls,0);
});
