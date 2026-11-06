import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/src/styles.css',import.meta.url),'utf8');

test('v1.5.1: CTA de estado vacío de hábitos está separado del texto',()=>{
  assert.match(app,/class="empty empty-state"/);
  assert.match(app,/class="empty-state-message">Todavía no creaste hábitos\.<\/p>/);
  assert.match(app,/class="empty-state-actions">\$\{button\('Crear uno'/);
  assert.doesNotMatch(app,/Todavía no creaste hábitos\.<br\/>/);
  assert.match(css,/\.empty-state\{[^}]*gap:16px/);
});
test('v1.5.1: navegación lateral usa misma grilla e íconos distintos',()=>{
  assert.match(css,/\.rail-bottom\{padding:15px 0 0\}/);
  assert.match(app,/data-value="account"[^>]*>\$\{icon\('account'\)\}/);
  assert.match(app,/data-value="settings"[^>]*>\$\{icon\('settings'\)\}/);
  assert.doesNotMatch(app,/data-value="account"[^>]*>\$\{icon\('home'\)\}/);
});
test('v1.5.1: tacto, contraste claro y desbordes controlados',()=>{
  assert.match(css,/\.btn\.small,\.chip,\.tab,\.listrow button\.mini,\.habit-done,\.back\{min-height:44px\}/);
  assert.match(css,/--accent:#326f6d;--accent-strong:#326f6d/);
  assert.match(css,/\.account-user \.micro\{overflow-wrap:anywhere\}/);
  assert.match(css,/\.section-head\{flex-wrap:wrap\}/);
});
test('v1.5.1: las pestañas y filtros exponen la selección y no hay jerga técnica en footer',()=>{
  assert.match(app,/class="tabbar" role="group"/);
  assert.match(app,/data-value="gym" aria-pressed=/);
  assert.match(app,/data-value="other" aria-pressed=/);
  assert.match(app,/data-action="filter" data-value="\$\{k\}" aria-pressed=/);
  assert.doesNotMatch(app,/Mobile first · Dark \/ Light · PWA/);
});
