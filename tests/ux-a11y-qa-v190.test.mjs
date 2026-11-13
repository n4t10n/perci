import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const app=src('../public/src/app.js');
const css=src('../public/src/styles.css');
const account=src('../public/src/account-ui.js');
const sw=src('../public/sw.js');

test('P0: días de hábitos operables con teclado y nombre completo',()=>{
  assert.doesNotMatch(css,/\.checkday input\{display:none\}/);
  assert.match(css,/\.checkday:focus-within\{outline:/);
  assert.match(app,/name="hdays" value="\$\{i\}" aria-label=/);
});
test('P0: etiquetas asociadas al ejercicio y al input correspondiente',()=>{
  assert.match(app,/for="routine-sets-\$\{i\}"/);
  assert.match(app,/id="routine-sets-\$\{i\}"/);
  assert.match(app,/for="routine-reps-\$\{i\}"/);
});
test('P1: modal con focus trap, Escape, retorno y descripción',()=>{
  assert.match(app,/function closeAccessibleModal\(\)/);
  assert.match(app,/function modalFocusables\(\)/);
  assert.match(app,/aria-describedby="modalDescription"/);
  assert.match(app,/setAttribute\('inert',''\)/);
  assert.match(app,/e\.shiftKey/);
  assert.match(app,/case 'closeModal':closeAccessibleModal\(\)/);
});
test('P1: ajustes y onboarding muestran selección a lectores',()=>{
  assert.equal((app.match(/data-action="theme" data-value="\$\{k\}" aria-pressed=/g)||[]).length,2);
  assert.equal((app.match(/data-action="focus" data-value="\$\{k\}" aria-pressed=/g)||[]).length,2);
});
test('P1: calendario y series tienen estados semánticos',()=>{
  assert.match(app,/role="list" aria-label="Calendario de hábitos"/);
  assert.match(app,/role="list" aria-label="Actividad de la semana"/);
  assert.match(app,/aria-valuenow="\$\{completed\}"/);
});
test('P1: guardado de registros revierte cambios si falla persistencia',()=>{
  assert.match(app,/if\(!save\(\)\)\{state\.records=state\.records\.filter/);
  assert.match(app,/if\(!save\(\)\)\{for\(const key of Object\.keys\(r\)\)/);
  assert.match(app,/if\(verifiedRoundTrip&&!readOutbox\(uid\)\)/);
  assert.match(account,/Estado de tus datos/);
});
test('P2: responsive y contraste mantienen una sola caché de QA',()=>{
  assert.match(css,/--muted2:#526c66/);
  assert.match(css,/@media\(min-width:701px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(sw,/perci-shell-v1\.12\.3-in-app-demo/);
});
test('P1: tokens de texto tenue alcanzan 4.5:1 en superficies del tema claro',()=>{
  const block=css.match(/:root\[data-theme="light"\]\{([^}]+)\}/)?.[1]||'';
  const token=name=>block.match(new RegExp(`${name}:(#[0-9a-f]{6})`))?.[1];
  const luminance=hex=>{
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
  };
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  for(const surface of ['--bg','--surface','--surface2'])assert.ok(contrast(token('--muted2'),token(surface))>=4.5,`Contraste insuficiente para ${surface}`);
});
