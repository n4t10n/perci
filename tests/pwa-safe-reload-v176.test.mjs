import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(
  new URL('../public/src/app.js',import.meta.url),'utf8'
);
const start=source.indexOf('let pendingPwaUpdate=false;');
const end=source.indexOf(
  "document.addEventListener('perci:pwa-updated'",start
);
assert.ok(start>=0&&end>start);
const code=source.slice(start,end);
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function scenario(options={}){
  const tasks=[];
  let reloads=0;
  const context=vm.createContext({
    account:{
      ready:true,authenticated:true,user:{id:uid},
      busy:false,syncPaused:false,syncFailed:false,
      ...options.account
    },
    app:{
      activeUid:uid,hydrating:false,cloudConflict:null,
      modal:null,needLegacyChoice:false,view:'home',
      ...options.app
    },
    state:{draft:null,...options.state},
    readOutbox:()=>options.outbox??null,
    allDeleteIntents:()=>options.deletions??{
      routines:[],records:[],habits:[]
    },
    hasDeleteIntents:value=>
      ['routines','records','habits'].some(
        k=>(value[k]||[]).length>0
      ),
    isOfflineNow:()=>Boolean(options.offline),
    queueMicrotask:fn=>tasks.push(fn),
    window:{location:{reload:()=>{reloads++}}}
  });
  vm.runInContext(code,context);
  return {
    request:()=>vm.runInContext(
      'pendingPwaUpdate=true;applyPendingPwaUpdate()',
      context
    ),
    retry:()=>vm.runInContext(
      'applyPendingPwaUpdate()',context
    ),
    flush:()=>{while(tasks.length)tasks.shift()()},
    get reloads(){return reloads},
    get scheduled(){return tasks.length}
  };
}

test('PWA puede actualizarse cuando todo está sincronizado',()=>{
  const s=scenario();
  s.request();
  s.flush();
  assert.equal(s.reloads,1);
});

test('PWA espera a que se sincronice el outbox',()=>{
  const options={outbox:{revision:1}};
  const s=scenario(options);
  s.request();
  assert.equal(s.scheduled,0);
  options.outbox=null;
  s.retry();
  s.flush();
  assert.equal(s.reloads,1);
});

test('PWA espera eliminaciones pendientes',()=>{
  const options={deletions:{routines:['r1'],records:[],habits:[]}};
  const s=scenario(options);
  s.request();
  assert.equal(s.reloads,0);
  assert.equal(s.scheduled,0);
  options.deletions={routines:[],records:[],habits:[]};
  s.retry();
  s.flush();
  assert.equal(s.reloads,1);
});

test('PWA no interrumpe una sincronización pausada',()=>{
  const s=scenario({account:{syncPaused:true}});
  s.request();
  s.flush();
  assert.equal(s.reloads,0);
});

test('PWA no interrumpe sesiones ni estados offline',()=>{
  for(const options of [
    {app:{view:'session'}},
    {state:{draft:{id:'draft1'}}},
    {offline:true},
    {account:{syncFailed:true}}
  ]){
    const s=scenario(options);
    s.request();
    s.flush();
    assert.equal(s.reloads,0);
  }
});

test('PWA vuelve a comprobar el estado antes de recargar',()=>{
  const options={};
  const s=scenario(options);
  s.request();
  assert.equal(s.scheduled,1);
  options.outbox={revision:2};
  s.flush();
  assert.equal(s.reloads,0);
  options.outbox=null;
  s.retry();
  s.flush();
  assert.equal(s.reloads,1);
});
