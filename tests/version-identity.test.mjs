import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../public/',import.meta.url);
const urlToPath=s=>new URL(s,root);
const moduleCache=new Map();
const currentModules=new Set(['src/app.js','src/account.js','src/account-ui.js','src/profile-avatar.js','src/data/offline-outbox.js','src/data/auto-hydration.js','src/domain/training-insights.js','src/domain/exercise-context.js','src/data/first-device-hydration.js']);
function expectedVersion(rel){
  if(currentModules.has(rel))return '1.19.0';
  if(rel==='src/domain/real-exercise-media.js')return '1.12.1';
  if(rel==='src/domain/exercise-catalog.js')return '1.12.0';
  if(rel==='src/domain/historical-sets.js')return '1.10.0';
  return '1.7.6';
}

function walk(rel){
  const u=urlToPath(rel),id=u.pathname;
  const existing=moduleCache.get(id);
  if(existing){assert.equal(existing,u.search,`Módulo ${id} importado con dos versiones: ${existing} / ${u.search}`);return}
  const expected='?v='+expectedVersion(path.posix.relative(root.pathname,id));
  assert.equal(u.search,expected,`${rel} sin la identidad de versión esperada`);
  moduleCache.set(id,u.search);
  const content=fs.readFileSync(u,'utf8');
  const rx=/\bfrom\s*['"](\.[^'"?]+\.js(?:\?v=[\d.]+)?)['"]/g;
  for(const match of content.matchAll(rx)){
    const moduleURL=new URL(match[1],u);
    walk(path.posix.relative(root.pathname,moduleURL.pathname)+moduleURL.search);
  }
}
test('v1.7.6: cuenta, UI y outbox son una única instancia de módulo por navegador',()=>{
  moduleCache.clear();walk('src/app.js?v=1.19.0');
  assert.ok(moduleCache.has(urlToPath('src/account.js').pathname));
  assert.ok(moduleCache.has(urlToPath('src/data/offline-outbox.js').pathname));
  assert.ok(moduleCache.size>=12);
  const account=fs.readFileSync(new URL('../public/src/account-ui.js',import.meta.url),'utf8');
  assert.match(account,/account\.js\?v=1\.19\.0/);
  assert.match(account,/offline-outbox\.js\?v=1\.19\.0/);
});
test('v1.7.6: precache y entrada usan el mismo grafo de módulos',()=>{
  const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  moduleCache.clear();walk('src/app.js?v=1.19.0');
  for(const id of moduleCache.keys()){
    const rel=path.posix.relative(root.pathname,id);
    assert.ok(sw.includes(`'./${rel}?v=${expectedVersion(rel)}'`),`SW no cachea ${rel} con query correcta`);
  }
  assert.match(html,/src\/app\.js\?v=1\.19\.0/);
  assert.match(html,/src\/pwa\.js\?v=1\.7\.6/);
  assert.match(sw,/perci-shell-v1\.19\.0-exercise-context/);
});
test('v1.7.6: se verifica nuevo service worker sin interrumpir formularios',()=>{
  const pwa=fs.readFileSync(new URL('../public/src/pwa.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
  assert.match(pwa,/controllerchange/);
  assert.match(pwa,/registration\.update\(\)/);
  assert.match(pwa,/updateViaCache: 'none'/);
  assert.match(app,/function applyPendingPwaUpdate\(\)/);
  assert.match(app,/state\.draft/);
  assert.match(app,/\['routineEdit','habitEdit','session','sessionSummary','record','recordSetsEdit','otherForm'\]/);
});
