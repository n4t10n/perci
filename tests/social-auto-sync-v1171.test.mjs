import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');

function harness(next, overrides={}){
  const el=Object.fromEntries(['received','friends','sent'].map(key=>[key,{innerHTML:'old '+key}]));
  const prev={profile:{code:'OLD'},friends:[{requestId:'f-1',name:'Uno'}],received:[],sent:[]};
  const social={data:prev,busy:false,loading:false,profileBusy:false,avatarImages:{'f-1':'photo'},profileTarget:null,profileData:null};
  const calls={api:0,render:0,avatar:0,go:0,toast:0};
  const ctx={
    app:{activeUid:'user-1',view:'social',social},
    account:{authenticated:true,user:{id:'user-1'}},
    document:{visibilityState:'visible',querySelector:sel=>el[sel.match(/data-social-rows="([^"]+)/)?.[1]]||null},
    isOfflineNow:()=>false,Date:{now:()=>100000},
    socialApi:async()=>{calls.api++;return next;},
    socialFriendRows:(data,name)=>`${name}:${data.map(x=>x.name).join(',')}`,
    queueMicrotask:()=>{calls.avatar++;},
    loadSocial:()=>{},go:()=>{calls.go++;},toast:()=>{calls.toast++;},
    ...overrides
  };
  const start=app.indexOf('const SOCIAL_SYNC_INTERVAL_MS=15000;');
  const end=app.indexOf('async function loadSocial(){',start);
  assert.ok(start>0&&end>start,'El bloque de sincronización debe existir');
  const funcs=vm.runInNewContext(app.slice(start,end)+'\n;({socialShouldAutoSync,refreshSocialAutomatically})',ctx);
  return {ctx,el,prev,social,calls,...funcs};
}

test('Social se sincroniza sin botón Actualizar y sin alterar los formularios',async()=>{
  assert.doesNotMatch(app,/button\('Actualizar','socialRefresh'/);
  assert.match(app,/data-social-rows="received"/);
  assert.match(app,/data-social-rows="friends"/);
  assert.match(app,/data-social-rows="sent"/);
  assert.match(app,/setInterval\(\(\)=>\{if\(socialShouldAutoSync\(\)\)/);
  assert.match(app,/document\.visibilityState!=='hidden'/);
  const next={profile:{code:'OLD'},friends:[{requestId:'f-1',name:'Uno'}],received:[{requestId:'p-1',name:'Dos'}],sent:[]};
  const h=harness(next);
  await h.refreshSocialAutomatically();
  assert.equal(h.calls.api,1);
  assert.equal(h.el.received.innerHTML,'received:Dos');
  assert.equal(h.el.friends.innerHTML,'old friends','No debe reconstruir una lista sin cambios');
  assert.equal(h.el.sent.innerHTML,'old sent');
  assert.equal(h.calls.render,0,'No debe regenerar campos de perfil ni buscador');
  assert.equal(h.social.data.received.length,1);
});

test('Social no consulta en segundo plano y mantiene última lista ante fallo',async()=>{
  const next={profile:{code:'OLD'},friends:[],received:[],sent:[]};
  const h=harness(next);
  h.ctx.document.visibilityState='hidden';
  await h.refreshSocialAutomatically();
  assert.equal(h.calls.api,0);
  assert.equal(h.social.data,h.prev);
  const fail=harness(next,{socialApi:async()=>{throw Error('sin red')}});
  await fail.refreshSocialAutomatically();
  assert.equal(fail.social.data,fail.prev);
});

test('Si se elimina amistad mientras mirás su perfil, se cierra y retira acceso',async()=>{
  const h=harness({profile:{code:'OLD'},friends:[],received:[],sent:[]});
  h.ctx.app.view='socialProfile';
  h.social.profileTarget='f-1';h.social.profileData={profile:{name:'Uno'}};
  await h.refreshSocialAutomatically();
  assert.equal(h.social.profileTarget,null);
  assert.equal(h.social.profileData,null);
  assert.equal(h.social.avatarImages['f-1'],undefined);
  assert.equal(h.calls.go,1);
});

test('La reconexión histórica de iPhone sigue intacta y Social usa eventos separados',()=>{
  assert.match(app,/window\.addEventListener\('online',\(\)=>refreshConnectionAware\(0\)\)/);
  assert.match(app,/window\.addEventListener\('focus',\(\)=>refreshConnectionAware\(\)\)/);
  assert.match(app,/if\(document\.visibilityState!=='hidden'\)refreshConnectionAware\(0\)/);
  assert.match(app,/window\.addEventListener\('online',\(\)=>\{void refreshSocialAutomatically\(\);\}\)/);
  assert.match(app,/window\.addEventListener\('focus',\(\)=>\{void refreshSocialAutomatically\(\);\}\)/);
});

test('Las dos versiones del shell JS y CSS se actualizan juntas',()=>{
  assert.match(sw,/perci-shell-v1\.17\.1-social-auto-sync/);
  assert.match(sw,/src\/app\.js\?v=1\.17\.1/);
  assert.match(sw,/src\/styles\.css\?v=1\.17\.1/);
  assert.match(html,/src\/app\.js\?v=1\.17\.1/);
  assert.match(html,/src\/styles\.css\?v=1\.17\.1/);
});
