import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('v1.7.6: la cuenta completa recupera su configuración de Supabase antes de navegar',()=>{
  const app=read('../public/src/app.js');
  assert.match(app,/function restoreCloudProfile\(snapshot,remote,local\)/);
  assert.match(app,/remote\.onboardSeen===true/);
  assert.match(app,/const restored=restoreCloudProfile\(result\.snapshot,remote,state\)/);
  assert.match(app,/if\(!silent\)app\.view=getInitialView\(state\)/);
  assert.match(app,/hydrateCloud\(account\.user\.id\);\s*\}else render\(\);/);
});
test('v1.7.6: tema y enfoque viajan en el mismo commit atómico',()=>{
  const app=read('../public/src/app.js');
  const atomic=read('../server/perci_atomic.py');
  assert.match(app,/Object\.assign\(result\.snapshot,cloudProfileForCommit\(pending,remote\)\)/);
  assert.match(app,/confirmed\?\.onboardSeen!==result\.snapshot\.onboardSeen/);
  assert.match(atomic,/core\.select_rows\('perci_profiles', token, user/);
});
