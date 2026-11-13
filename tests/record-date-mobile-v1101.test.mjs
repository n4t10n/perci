import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../public/src/app.js');
const css=read('../public/src/styles.css');
const sw=read('../public/sw.js');
const html=read('../public/index.html');

test('Historial: fecha renderizada dentro de un control recortado y accesible en Safari iPhone',()=>{
  const start=app.indexOf('function renderRecord(){');
  const end=app.indexOf('function renderRecordSetsEdit(){',start);
  assert.ok(start>0&&end>start);
  const part=app.slice(start,end);
  assert.match(part,/class="field record-date-field"/);
  assert.match(part,/class="record-date-control"/);
  assert.match(part,/id="rdateText" aria-hidden="true"/);
  assert.match(part,/formatSessionDate\(r\.date\)/);
  assert.match(part,/type="date" id="rdate" value="\$\{h\(r\.date\)\}" aria-label="Fecha del registro"/);
  assert.match(app,/if\(e\.target\.id==='rdate'&&app\.view==='record'\)/);
  assert.match(app,/display\.textContent=formatSessionDate\(e\.target\.value\)/);
});
test('Historial: fecha no se desborda y el input nativo mantiene apertura y foco',()=>{
  assert.match(css,/\.record-date-control\{[^}]*overflow:hidden/);
  assert.match(css,/\.record-date-control\{[^}]*width:100%;max-width:100%;min-width:0/);
  assert.match(css,/\.record-date-control input\[type=date\]\{[^}]*opacity:0;cursor:pointer/);
  assert.match(css,/\.record-date-control:focus-within\{outline:/);
});
test('Historial: assets y Service Worker renuevan caché juntos sin tocar módulos de datos',()=>{
  assert.match(sw,/perci-shell-v1\.11\.0-muscle-library/);
  assert.match(sw,/src\/app\.js\?v=1\.11\.0/);
  assert.match(sw,/src\/styles\.css\?v=1\.11\.0/);
  assert.match(html,/src\/app\.js\?v=1\.11\.0/);
  assert.match(html,/src\/styles\.css\?v=1\.11\.0/);
  assert.match(sw,/domain\/historical-sets\.js\?v=1\.10\.0/);
});
