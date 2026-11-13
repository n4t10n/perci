import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('public/src/app.js');
const account=read('public/src/account-ui.js');
const avatar=read('public/src/profile-avatar.js');
const api=read('api/shared.py');
const server=read('server/perci_avatar.py');
const sw=read('public/sw.js');
const html=read('public/index.html');
const css=read('public/src/styles.css');
const migration=read('supabase/migrations/202611130001_perci_avatar_storage_qa.sql');

test('v1.13: la foto se ve en Mi cuenta y header con inicial de respaldo',()=>{
 assert.match(app,/data-profile-avatar="\$\{h\(account\.user\?\.id/);
 assert.match(app,/avatarMarkup\(account\.user\)/);
 assert.match(account,/data-profile-avatar="\$\{esc\(account\.user\?\.id/);
 assert.match(account,/data-avatar-action="choose"/);
 assert.match(account,/data-avatar-action="remove"/);
 assert.match(avatar,/accountInitial\(user\)/);
 assert.match(avatar,/CACHE_PREFIX\+uid/);
});

test('v1.13: editor nativo accesible recorta, mueve, permite cancelar y guardar',()=>{
 assert.match(avatar,/<dialog class="avatar-editor"/);
 assert.match(avatar,/dialog\.showModal\(\)/);
 assert.match(avatar,/URL\.revokeObjectURL/);
 assert.match(avatar,/canvas\.toBlob\(resolve,'image\/webp'/);
 assert.match(avatar,/data-avatar-move="left"/);
 assert.match(avatar,/data-avatar-action="cancel"/);
 assert.match(avatar,/data-avatar-action="save"/);
 assert.match(account,/data-avatar-action="remove"/);
 assert.match(avatar,/type="range"/);
 assert.match(css,/@media\(max-width:480px\)/);
});

test('v1.13: perfil privado aislado del snapshot y los datos offline',()=>{
 assert.match(avatar,/perci_avatar_v113_/);
 assert.match(avatar,/if\(displayUid!==user\.id\)/);
 assert.match(avatar,/if\(selected\?\.uid!==uid&&selected\)discard/);
 assert.match(avatar,/account\.offline/);
 assert.match(api,/self\.authenticated\(\)/);
 assert.match(api,/perci_avatar\.fetch\(core, token, user\['id'\]\)/);
 assert.match(api,/perci_avatar\.update\(core, token, user\['id'\], body\)/);
 assert.match(server,/Authorization': 'Bearer ' \+ token/);
 assert.doesNotMatch(server,/service_role|sb_secret_/);
 assert.match(migration,/public = false/);
 assert.match(migration,/to authenticated/);
 assert.doesNotMatch(migration,/to public with check/);
 assert.doesNotMatch(app,/storage\/v1\/object\/public/);
});

test('v1.13: origen/cookie autenticados, JPG/PNG/HEIC se convierten a WebP seguro',()=>{
 assert.match(api,/self\.check_post\(\)/);
 assert.match(avatar,/MAX_ORIGINAL=10\*1024\*1024/);
 assert.match(avatar,/image\/heic/);
 assert.match(avatar,/image\/webp/);
 assert.match(server,/base64\.b64decode\(encoded, validate=True\)/);
 assert.match(server,/MAX_AVATAR_BYTES = 200_000/);
 assert.match(server,/_object_path\(user_id\)/); // user ID comes from authenticated session
});

test('v1.13: caché PWA coherente sin precachear fotos privadas',()=>{
 assert.match(sw,/perci-shell-v1\.13\.0-avatar/);
 assert.match(sw,/src\/profile-avatar\.js\?v=1\.13\.0/);
 assert.match(sw,/src\/account-ui\.js\?v=1\.13\.0/);
 assert.match(sw,/src\/app\.js\?v=1\.13\.0/);
 assert.match(sw,/src\/styles\.css\?v=1\.13\.0/);
 assert.match(html,/src\/app\.js\?v=1\.13\.0/);
 assert.match(html,/src\/styles\.css\?v=1\.13\.0/);
 assert.doesNotMatch(sw,/perci-avatars-qa|api\/profile\/avatar/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
});
