import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const modal=app.slice(app.indexOf('function renderModal(){'),app.indexOf('function render(){'));
const settings=app.slice(app.indexOf('function renderSettings(){'),app.indexOf('function renderOnboard(){'));
test('v1.12.2: el modal muestra movimiento sin textos de procedencia o patrocinio',()=>{
  assert.match(modal,/<div class="eyebrow">DEMOSTRACIÓN<\/div>/);
  assert.match(modal,/class="exercise-demo-video"/);
  assert.match(modal,/id="modalDescription"/);
  assert.match(modal,/Variante:/);
  assert.doesNotMatch(modal,/Demostración filmada con una persona real|Sin vínculo de patrocinio con Percí|exercise-demo-credit/);
});
test('v1.12.2: atribución de Your Move queda disponible en sección Licencias',()=>{
  assert.match(settings,/Licencias de contenido/);
  assert.match(settings,/Exercise video by Your Move/);
  assert.match(settings,/https:\/\/ymove\.app\/exercise-api/);
  assert.doesNotMatch(modal,/https:\/\/ymove\.app/);
});
