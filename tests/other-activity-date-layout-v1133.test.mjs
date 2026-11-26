import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../public/src/app.js');
const css=read('../public/src/styles.css');
const html=read('../public/index.html');
const sw=read('../public/sw.js');

test('Otras actividades usan una grilla de ancho restringido, sin minimo intrinseco',()=>{
  const start=app.indexOf('function renderOtherForm(){');
  const end=app.indexOf('function renderStrengthEvolution(){',start);
  assert.ok(start>=0&&end>start);
  const form=app.slice(start,end);
  assert.match(form,/class="card other-activity-form"/);
  assert.match(form,/class="field record-date-field other-activity-date-field"/);
  assert.match(css,/\.other-activity-form\{[^}]*display:grid;[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/\.other-activity-form \.other-activity-date-field\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/\.other-activity-form \.other-activity-date-field \.record-date-control\{[^}]*width:100%;[^}]*min-width:0;[^}]*max-width:100%;[^}]*overflow:hidden/);
});
test('Comentario CSS valido, reglas record-date activas y control nativo conservado',()=>{
  assert.doesNotMatch(css,/^\*\([^\r\n]*v1\.10\.1/m);
  assert.match(css,/^\/\* \([^\r\n]*v1\.10\.1/m);
  assert.match(css,/\.record-date-field\{min-width:0;max-width:100%\}/);
  assert.match(css,/\.other-activity-form \.other-activity-date-field input\[type=date\]\{[^}]*min-width:0;[^}]*max-width:100%/);
  assert.match(css,/\.record-date-control input\[type=date\]\{[^}]*opacity:0;cursor:pointer/);
});
test('Service Worker y HTML usan los mismos assets nuevos y cache exclusiva',()=>{
  assert.match(sw,/perci-shell-v1\.19\.2-exercise-context/);
  assert.match(sw,/src\/app\.js\?v=1\.19\.2/);
  assert.match(sw,/src\/styles\.css\?v=1\.19\.2/);
  assert.match(html,/src\/app\.js\?v=1\.19\.2/);
  assert.match(html,/src\/styles\.css\?v=1\.19\.2/);
  assert.doesNotMatch(sw,/perci-avatars-qa/);
});
