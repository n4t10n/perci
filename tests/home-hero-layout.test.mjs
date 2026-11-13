import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const css=read('../public/src/styles.css');
const sw=read('../public/sw.js');
const html=read('../public/index.html');

test('Home mobile: la etiqueta decorativa participa del flujo y no pisa los botones',()=>{
  assert.match(css,/\/\* Percí v1\.8\.4 · Home: badge en flujo y botones sin superposición\. \*\//);
  assert.match(css,/@media\(max-width:700px\)\{\s*\.hero\{[^}]*flex-direction:column;align-items:stretch/);
  assert.match(css,/\.hero-content\{width:100%;max-width:100%;padding-bottom:8px\}/);
  assert.match(css,/\.hero-flair\{position:relative;[^}]*align-self:flex-end;[^}]*margin:12px 20px 20px auto/);
  assert.match(css,/\.hero \.btn\.session-cancel\{min-height:44px;padding:10px 14px;font-size:14px\}/);
});

test('PWA: el CSS v1.8.4 y la caché de Home cambian juntos, manteniendo el JS',()=>{
  assert.match(sw,/perci-shell-v1\.12\.0-exercise-gifs/);
  assert.match(sw,/src\/styles\.css\?v=1\.12\.0/);
  assert.match(html,/src\/styles\.css\?v=1\.12\.0/);
  assert.match(sw,/src\/app\.js\?v=1\.12\.0/);
  assert.match(html,/src\/app\.js\?v=1\.12\.0/);
});
