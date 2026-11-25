import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/src/styles.css',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
test('Social: perfil amigo protegido por ID de amistad y sin rutinas privadas',()=>{
  assert.match(app,/function openSocialProfile\(target\)/);
  assert.match(app,/social\.data\?\.friends\?\.some\(f=>f\.requestId===target\)/);
  assert.match(app,/target==='self'\?'myProfile':'profile'/);
  assert.match(app,/case 'socialOpenProfile':/);
  assert.match(app,/socialProfile:renderSocialProfile/);
});
test('Rutinas: publicación voluntaria y plantillas sin pesos ni historial',()=>{
  assert.match(app,/cleanSharedRoutine\(routine\)/);
  assert.match(app,/socialPublishRoutine/);
  assert.match(app,/socialUnpublishRoutine/);
  assert.match(app,/Solo yo/);
  assert.match(app,/Visible para amigos/);
  assert.match(app,/¿Mostrar esta rutina a tus amigos\?/);
});
test('Perfil: foto privada, inicial, presentación y responsive',()=>{
  assert.match(app,/s\.avatarImages\?\.\[s\.profileTarget\]/);
  assert.match(app,/socialProfileBio/);
  assert.match(css,/\.social-profile-hero\{/);
  assert.match(css,/@media\(max-width:700px\)\{\.social-profile-hero/);
  assert.match(sw,/perci-shell-v1\.18\.0-exercise-context/);
});
