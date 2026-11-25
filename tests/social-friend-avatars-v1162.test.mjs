import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../public/src/app.js'),css=read('../public/src/styles.css'),sw=read('../public/sw.js'),html=read('../public/index.html');
test('Solo muestra fotos de amistades aceptadas y borra caché al cambiar cuenta',()=>{
 assert.match(app,/function loadSocialFriendAvatars\(/);
 assert.match(app,/social\.data\.friends/);
 assert.match(app,/friendAvatar=/);
 assert.match(app,/mode==='friends'/);
 assert.match(app,/avatarImages:\{\}/);
 assert.match(app,/uid!==app\.activeUid\|\|app\.social!==social/);
});
test('La PWA renueva JS y CSS y conserva fallback con inicial',()=>{
 assert.match(css,/\.social-friend-row \.social-avatar img\{/);
 assert.match(sw,/perci-shell-v1\.19\.0-exercise-context/);
 assert.match(html,/src\/app\.js\?v=1\.19\.0/);
 assert.match(app,/String\(x\.name\|\|'\?'\)/);
});
