import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/src/styles.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
test('Social: búsqueda precisa y confirmación antes de invitar',()=>{
  assert.match(app,/function socialLookupInput\(/);
  assert.match(app,/case 'socialFind':/);
  assert.match(app,/case 'socialInviteLookup':/);
  assert.match(app,/s\.found\.name/);
  assert.match(app,/const lookup=app\.social\.lookup/);
});
test('Social: descubrimiento por correo es explícito y no preseleccionado',()=>{
  assert.match(app,/socialEmailDiscoverable/);
  assert.match(app,/profile\.emailDiscoverable===true\?'checked':''/);
  assert.match(app,/emailDiscoverable=document\.getElementById/);
});
test('Social: separación vertical consistente en iPhone',()=>{
  assert.match(css,/\.social-stack\{display:grid;gap:18px/);
  assert.match(css,/@media\(max-width:700px\)\{\.social-stack\{gap:16px/);
  assert.match(app,/class="social-stack"/);
  assert.match(sw,/perci-shell-v1\.19\.1-exercise-context/);
});
