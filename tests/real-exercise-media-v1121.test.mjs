import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {EXERCISE_CATALOG} from '../public/src/domain/exercise-catalog.js';
import {REAL_EXERCISE_COUNT,getRealExerciseMedia} from '../public/src/domain/real-exercise-media.js';
const manifest=JSON.parse(readFileSync(new URL('../docs/real-exercise-sources-v1121.json',import.meta.url),'utf8'));
test('QA v1.12.1: clips filmados con fuentes explícitas y sin copyright incierto',()=>{
 assert.equal(EXERCISE_CATALOG.length,19);
 assert.equal(REAL_EXERCISE_COUNT,17);
 assert.equal(manifest.filter(x=>x.status==='ready').length,17);
 const ids=new Set();
 for(const item of manifest.filter(x=>x.status==='ready')){
  assert.ok(!ids.has(item.id));ids.add(item.id);
  assert.ok(['YMove','Pexels'].includes(item.provider));
  assert.match(item.page,/^https:\/\//);
  const media=getRealExerciseMedia(EXERCISE_CATALOG.find(x=>x.id===item.id).name);
  assert.equal(media.id,item.id);
  const movie=new URL('../public/'+media.video.replace(/^\.\//,''),import.meta.url);
  const poster=new URL('../public/'+media.poster.replace(/^\.\//,''),import.meta.url);
  const head=readFileSync(movie).subarray(4,12).toString('ascii');
  assert.match(head,/ftyp/,item.id);
  assert.ok(statSync(movie).size<6_000_000,item.id+' debe ser liviano');
  assert.equal(readFileSync(poster).subarray(0,3).toString('hex'),'ffd8ff');
 }
});
test('QA v1.12.1: mismo nombre usa video; nombres similares no heredan video',()=>{
 assert.equal(getRealExerciseMedia('  PRESS DE  BANCA ')?.id,'press-banca');
 assert.equal(getRealExerciseMedia('Curl martillo')?.id,'curl-martillo');
 assert.equal(getRealExerciseMedia('Press de banca en máquina'),null);
 assert.equal(getRealExerciseMedia(''),null);
 assert.equal(getRealExerciseMedia('Pájaros con mancuernas'),null,'No usar medios pagos sin licencia');
 assert.equal(getRealExerciseMedia('Hip thrust'),null,'Pendiente archivo gratuito autorizado');
});
test('QA v1.12.1: reproducción nativa con créditos y sin autoplay bajo reduce motion',()=>{
 const app=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 assert.match(app,/class="exercise-demo-video"/);
 assert.match(app,/prefers-reduced-motion: reduce/);
 assert.match(app,/target="_blank" rel="noopener noreferrer"/);
 assert.ok(app.includes('if(!match||!exerciseDemoAssets(value))break;'), 'La demostración debe rechazar ejercicios ajenos al catálogo');
 assert.match(sw,/perci-shell-v1\.13\.1-safari-jpeg/);
 assert.match(sw,/real-exercise-media\.js\?v=1\.12\.1/);
 assert.doesNotMatch(sw,/\.mp4'/,'Los videos no se precachean');
});
