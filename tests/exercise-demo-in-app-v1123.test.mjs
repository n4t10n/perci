import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {EXERCISE_CATALOG,exerciseDemoAssets} from '../public/src/domain/exercise-catalog.js';
import {getRealExerciseMedia} from '../public/src/domain/real-exercise-media.js';
const app=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const modal=app.slice(app.indexOf('function renderModal(){'),app.indexOf('function render(){'));

test('v1.12.3: 17 filmaciones y dos animaciones propias cubren los 19 ejercicios',()=>{
 assert.equal(EXERCISE_CATALOG.length,19);
 const illustrated=[];
 for(const exercise of EXERCISE_CATALOG){
   const real=getRealExerciseMedia(exercise.name);
   if(real)continue;
   illustrated.push(exercise.id);
   const media=exerciseDemoAssets(exercise.name);
   assert.ok(media);
   const gif=readFileSync(new URL('../public/'+media.gif.replace(/^\.\//,''),import.meta.url));
   assert.match(gif.subarray(0,6).toString('ascii'),/^GIF8[79]a$/);
   assert.ok(statSync(new URL('../public/'+media.gif.replace(/^\.\//,''),import.meta.url)).size<180_000);
 }
 assert.deepEqual(illustrated.sort(),['hip-thrust','pajaros-mancuernas']);
});

test('v1.12.3: mismo modal, fallback offline, accesibilidad y movimiento reducido',()=>{
 assert.match(app,/aria-label="Ver ilustración animada de/);
 assert.match(app,/if\(!match\|\|!exerciseDemoAssets\(value\)\)break/);
 assert.match(modal,/const illustrated=exerciseDemoAssets\(m\.demoName\)/);
 assert.match(modal,/still\?illustrated\.poster:illustrated\.gif/);
 assert.match(modal,/data-exercise-gif/);
 assert.match(modal,/data-exercise-poster/);
 assert.match(modal,/Animación ilustrativa temporal/);
 assert.match(modal,/class="exercise-demo-video"/);
 assert.doesNotMatch(modal,/fitcron\.com|Sin vínculo de patrocinio|Demostración filmada con una persona real/);
 assert.match(app,/el\.removeAttribute\('data-exercise-gif'\)/);
 assert.match(app,/prefers-reduced-motion: reduce/);
});

test('v1.12.3: ningún GIF remoto o de terceros se precachea',()=>{
 assert.match(sw,/perci-shell-v1\.13\.0-avatar/);
 assert.match(sw,/src\/app\.js\?v=1\.13\.0/);
 assert.doesNotMatch(sw,/\.gif'/);
 assert.doesNotMatch(app,/fitcron\.com/);
});
