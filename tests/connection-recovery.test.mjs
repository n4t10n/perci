import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const callbacks=new Map();
const store=new Map();
globalThis.window={
  addEventListener(name,cb){callbacks.set(name,cb);},
  location:{pathname:'/',search:'',hash:''},
  history:{replaceState(){}},
};
globalThis.localStorage={
  getItem:key=>store.get(key)??null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key),
};
let fetchCount=0;
let fulfillFetch=null;
const uid='d782175e-1136-4f7d-958a-e6c82fc504eb';
globalThis.fetch=async(path)=>{
  assert.equal(path,'/api/auth/session');
  fetchCount++;
  await new Promise(resolve=>{fulfillFetch=resolve});
  return {ok:true,status:200,json:async()=>({authenticated:true,configured:true,user:{id:uid,email:'xecloto@gmail.com',name:'QA'}})};
};
const {account,onAccountChange,probeOfflineAccount}=await import('../public/src/account.js?v=1.7.6');

test('iPhone: recuperar sesión no depende de que Safari dispare evento online',async()=>{
  Object.assign(account,{ready:true,authenticated:true,user:{id:uid,email:'xecloto@gmail.com'},offline:true});
  let changes=0;
  onAccountChange(()=>{changes++});
  const attempt=probeOfflineAccount();
  assert.equal(fetchCount,1);
  fulfillFetch();
  assert.equal(await attempt,true);
  assert.equal(account.offline,false);
  assert.equal(account.verifiedOnline,true);
  assert.ok(account.verifiedOnlineAt>0);
  assert.equal(account.user.id,uid);
  assert.ok(changes>=1,'debe notificar al orquestador para que compare con la nube');
});

test('dos señales de reconexión simultáneas hacen una sola lectura de sesión',async()=>{
  Object.assign(account,{authenticated:true,offline:true,user:{id:uid}});
  const before=fetchCount;
  const a=probeOfflineAccount();
  const b=probeOfflineAccount();
  assert.strictEqual(a,b,'misma promesa de comprobación');
  assert.equal(fetchCount,before+1);
  fulfillFetch();
  assert.equal(await a,true);
});

test('sin sesión autenticada no se realizan lecturas de reconexión',async()=>{
  Object.assign(account,{authenticated:false,user:null,offline:false});
  const before=fetchCount;
  assert.equal(await probeOfflineAccount(),false);
  assert.equal(fetchCount,before);
});

test('v1.6.5: iPhone reintenta conexión al volver del background sin refresh manual',()=>{
  const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
  const auth=fs.readFileSync(new URL('../public/src/account.js',import.meta.url),'utf8');
  assert.match(app,/function refreshConnectionAware\(minAgeMs=6000\)/);
  assert.match(app,/if\(!account\.offline && !isOfflineNow\(account\)\)return refreshAccountAutomatically\(minAgeMs\)/);
  assert.match(app,/probeOfflineAccount\(\)\.then\(connected=>/);
  assert.match(app,/window\.addEventListener\('online',\(\)=>refreshConnectionAware\(0\)\)/);
  assert.match(app,/window\.addEventListener\('focus',\(\)=>refreshConnectionAware\(\)\)/);
  assert.match(app,/document\.addEventListener\('visibilitychange'/);
  assert.match(app,/window\.addEventListener\('pageshow'/);
  assert.match(app,/setInterval\(\(\)=>refreshConnectionAware\(30000\),12000\)/);
  assert.match(app,/app\.modal\|\|state\.draft/);
  assert.match(auth,/window\.addEventListener\('online',\(\)=>\{probeOfflineAccount\(\)/);
});

test('Safari conserva navigator.onLine=false, pero servidor ya confirmó acceso',async()=>{
  const {isOfflineNow}=await import('../public/src/data/offline-outbox.js?v=1.7.6');
  const prior=globalThis.navigator;
  try{
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
    assert.equal(isOfflineNow({offline:false,verifiedOnline:false}),true);
    assert.equal(isOfflineNow({offline:false,verifiedOnline:true,verifiedOnlineAt:Date.now()}),false);
    assert.equal(isOfflineNow({offline:false,verifiedOnline:true,verifiedOnlineAt:Date.now()-70000}),true);
    assert.equal(isOfflineNow({offline:true,verifiedOnline:true,verifiedOnlineAt:Date.now()}),true);
  }finally{
    if(prior===undefined)delete globalThis.navigator;
    else Object.defineProperty(globalThis,'navigator',{configurable:true,value:prior});
  }
});
