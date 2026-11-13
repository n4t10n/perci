import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../public/',import.meta.url);
const urlToPath=s=>new URL(s,root);
const moduleCache=new Map();
function walk(rel){
  const u=urlToPath(rel),id=u.pathname;
  const existing=moduleCache.get(id);
  if(existing){assert.equal(existing,u.search,`Módulo ${id} importado con dos versiones: ${existing} / ${u.search}`);return}
  assert.equal(u.search,id.endsWith('/src/app.js')?'?v=1.9.0':'?v=1.7.6',`${rel} sin la identidad de versión esperada`);
  moduleCache.set(id,u.search);
  const content=fs.readFileSync(u,'utf8');
  const rx=/\bfrom\s*['"](\.[^'"?]+\.js(?:\?v=[\d.]+)?)['"]/g;
  for(const match of content.matchAll(rx)){
    const moduleURL=new URL(match[1],u);
    walk(path.posix.relative(root.pathname,moduleURL.pathname)+moduleURL.search);
  }
}
test('v1.7.6: cuenta, UI y outbox son una única instancia de módulo por navegador',()=>{
  moduleCache.clear();walk('src/app.js?v=1.9.0');
  assert.ok(moduleCache.has(urlToPath('src/account.js').pathname));
  assert.ok(moduleCache.has(urlToPath('src/data/offline-outbox.js').pathname));
  assert.ok(moduleCache.size>=12);
  const account=fs.readFileSync(new URL('../public/src/account-ui.js',import.meta.url),'utf8');
  assert.match(account,/account\.js\?v=1\.7\.6/);
  assert.match(account,/offline-outbox\.js\?v=1\.7\.6/);
});
test('v1.7.6: precache y entrada usan el mismo grafo de módulos',()=>{
  const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  for(const id of moduleCache.keys()){
    const rel=path.posix.relative(root.pathname,id);
    assert.ok(sw.includes(`'./${rel}?v=${rel==='src/app.js'?'1.9.0':'1.7.6'}'`),`SW no cachea ${rel} con query correcta`);
  }
  assert.match(html,/src\/app\.js\?v=1\.9\.0/);
  assert.match(html,/src\/pwa\.js\?v=1\.7\.6/);
  assert.match(sw,/perci-shell-v1\.9\.0-qa-accessibility-ux/);
});
test('v1.7.6: se verifica nuevo service worker sin interrumpir formularios',()=>{
  const pwa=fs.readFileSync(new URL('../public/src/pwa.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
  assert.match(pwa,/controllerchange/);
  assert.match(pwa,/registration\.update\(\)/);
  assert.match(pwa,/updateViaCache: 'none'/);
  assert.match(app,/function applyPendingPwaUpdate\(\)/);
  assert.match(app,/state\.draft/);
  assert.match(app,/\['routineEdit','habitEdit','session','sessionSummary','record','otherForm'\]/);
});
