import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {EXERCISE_CATALOG,findCatalogExercise,exerciseDemoAssets} from '../public/src/domain/exercise-catalog.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../public/src/app.js');
const sw=read('../public/sw.js');
const css=read('../public/src/styles.css');
const html=read('../public/index.html');
const assets=JSON.parse(read('../docs/media-inventory-v112.json'));

test('GIFs v1.12: 19 demostraciones originales, todos los ejercicios cubiertos',()=>{
  assert.equal(EXERCISE_CATALOG.length,19);
  assert.equal(assets.length,19);
  assert.equal(new Set(assets.map(x=>x.id)).size,19);
  for(const exercise of EXERCISE_CATALOG){
    const media=exerciseDemoAssets(exercise.name);
    assert.ok(media,exercise.name);
    assert.equal(media.id,exercise.id);
    assert.equal(media.poster,`./assets/exercises/${exercise.id}.webp`);
    assert.equal(media.gif,`./assets/exercises/${exercise.id}.gif`);
    const gifPath=new URL('../public/'+media.gif.replace(/^\.\//,''),import.meta.url);
    const posterPath=new URL('../public/'+media.poster.replace(/^\.\//,''),import.meta.url);
    const gif=readFileSync(gifPath);
    assert.match(gif.subarray(0,6).toString('ascii'),/^GIF8[79]a$/,exercise.id);
    assert.equal(readFileSync(posterPath).subarray(0,4).toString('ascii'),'RIFF',exercise.id);
    assert.ok(statSync(gifPath).size<180000,`GIF demasiado pesado: ${exercise.id}`);
  }
});

test('Personalizados equivalentes usan el GIF de catálogo sin coincidencias falsas',()=>{
  for(const ex of EXERCISE_CATALOG){
    const variant=`  ${ex.name.toLocaleUpperCase('es-AR').split(' ').join('   ')}  `;
    assert.equal(exerciseDemoAssets(variant)?.id,ex.id,ex.name);
    assert.equal(findCatalogExercise(variant)?.id,ex.id);
  }
  assert.equal(exerciseDemoAssets('Press de banca en máquina'),null);
  assert.equal(exerciseDemoAssets('Curl martillo invertido'),null);
  assert.equal(exerciseDemoAssets(''),null);
  assert.equal(exerciseDemoAssets('<script>'),null);
});

test('Los GIFs son opt-in, imágenes previas no alteran la rutina ni el historial',()=>{
  assert.match(app,/const exerciseDemoButton=name=>/);
  assert.match(app,/data-action="showExerciseDemo"/);
  assert.match(app,/\$\{exerciseDemoButton\(e\.name\)\}/);
  assert.match(app,/\$\{exerciseDemoButton\(item\.name\)\}/);
  assert.match(app,/\$\{exerciseDemoButton\(x\.exerciseName\)\}/);
  assert.match(app,/case 'showExerciseDemo':/);
  assert.match(app,/findCatalogExercise\(value\)/);
  assert.match(app,/app\.modal=\{demoName:match\.name\}/);
  assert.match(app,/button\('Cerrar','closeModal'/);
  assert.doesNotMatch(app.slice(app.indexOf("case 'showExerciseDemo':"),app.indexOf("case 'library':",app.indexOf("case 'showExerciseDemo':"))),/save\(\)|state\.records\s*=|state\.routines\s*=/);
});

test('Fallback offline, preferencia de movimiento reducido y lectura accesible',()=>{
  assert.match(app,/prefers-reduced-motion: reduce/);
  // iOS Safari puede reportar falsamente offline: probar GIF y usar fallback si falla la carga.
  assert.match(app,/data-exercise-poster/);
  assert.match(app,/addEventListener\('error',event=>/);
  assert.match(app,/el\.removeAttribute\('data-exercise-gif'\)/);
  assert.match(app,/aria-label="Ver demostración animada/);
  assert.match(app,/role="dialog" aria-modal="true"/);
  assert.match(css,/\.exercise-demo-modal\{/);
  assert.match(css,/@media\(max-width:480px\)/);
});

test('PWA v1.12: posters sí, GIFs bajo demanda, caché de JS/CSS coherente',()=>{
  assert.match(sw,/perci-shell-v1\.12\.0-exercise-gifs/);
  assert.match(sw,/src\/app\.js\?v=1\.12\.0/);
  assert.match(sw,/domain\/exercise-catalog\.js\?v=1\.12\.0/);
  assert.match(sw,/src\/styles\.css\?v=1\.12\.0/);
  assert.match(html,/src\/app\.js\?v=1\.12\.0/);
  assert.match(html,/src\/styles\.css\?v=1\.12\.0/);
  for(const entry of assets){
    assert.ok(sw.includes(`'./assets/exercises/${entry.id}.webp'`));
    assert.ok(!sw.includes(`'./assets/exercises/${entry.id}.gif'`),`No precachear GIF: ${entry.id}`);
  }
  assert.match(sw,/account\.js\?v=1\.7\.6/);
  assert.match(sw,/historical-sets\.js\?v=1\.10\.0/);
});

test('El botón de demostración reconoce nombres de ejercicios personalizados',()=>{
  const beginning=app.indexOf('const exerciseDemoButton=name=>');
  const end=app.indexOf('function renderLibrary(){',beginning);
  assert.ok(beginning>0&&end>beginning);
  const fragment=app.slice(beginning,end);
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=new Function('exerciseDemoAssets','h',`${fragment};return exerciseDemoButton;`)(exerciseDemoAssets,escape);
  assert.match(button(' PÁJAROS    CON MANCUERNAS '),/assets\/exercises\/pajaros-mancuernas\.webp/);
  assert.match(button('Press de banca'),/showExerciseDemo/);
  assert.equal(button('Press de banca en máquina'),'');
  assert.doesNotMatch(button('<script>alert(1)</script>'),/<script>/);
});
