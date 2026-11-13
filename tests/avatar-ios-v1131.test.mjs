import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const client=read('public/src/profile-avatar.js');
const server=read('server/perci_avatar.py');
const migration=read('supabase/migrations/202611130002_perci_avatar_jpeg_ios_qa.sql');
const sw=read('public/sw.js');
const html=read('public/index.html');
test('Safari: JPEG compatible y compresión progresiva del recorte',()=>{
  assert.match(client,/canvas\.toBlob\(resolve,'image\/jpeg'/);
  assert.match(client,/for\(const size of \[512,448,384,320\]\)/);
  assert.match(client,/mime:'image\/jpeg'/);
  assert.match(client,/validImage=value/);
  assert.match(client,/webp\|jpeg/);
  assert.doesNotMatch(client,/Este navegador no puede preparar WebP/);
});
test('exportar en iOS: si la foto pesa mucho, reduce calidad y conserva JPEG',async()=>{
  const start=client.indexOf('async function exportAvatar(){');
  const end=client.indexOf('async function saveAvatar(){',start);
  assert.ok(start>0 && end>start);
  const requests=[];
  const canvas={width:0,height:0,toBlob(callback,type,quality){
    requests.push({size:this.width,type,quality});
    callback({type:'image/jpeg',size:this.width>384?210000:140000});
  }};
  class Reader{readAsDataURL(){this.result='data:image/jpeg;base64,AA==';this.onload();}}
  const create=new Function('document','draw','MAX_ENCODED','validImage','FileReader',client.slice(start,end)+';return exportAvatar;');
  const exporter=create({createElement:()=>canvas},()=>{},200000,x=>x.startsWith('data:image/jpeg;'),Reader);
  const result=await exporter();
  assert.equal(result,'data:image/jpeg;base64,AA==');
  assert.ok(requests.length>5);
  assert.equal(requests[0].size,512);
  assert.ok(requests.some(r=>r.size===384));
  assert.ok(requests.every(r=>r.type==='image/jpeg'));
});
test('Servidor valida JPEG real y conserva WebP previo y privacidad',()=>{
  assert.match(server,/def _size_jpeg/);
  assert.match(server,/raw\[:2\] != b'/);
  assert.match(server,/image\/jpeg/);
  assert.match(server,/for extension in \('jpg', 'webp'\)/);
  assert.match(server,/Authorization': 'Bearer ' \+ token/);
  assert.doesNotMatch(server,/service_role|sb_secret_/);
});
test('RLS de JPEG y WebP restringida al usuario y bucket privado',()=>{
  assert.match(migration,/public = false/);
  assert.match(migration,/allowed_mime_types = array\['image\/webp','image\/jpeg'\]/);
  assert.match(migration,/\(select auth\.uid\(\)\)::text \|\| '\/avatar.jpg'/);
  assert.match(migration,/\(select auth\.uid\(\)\)::text \|\| '\/avatar.webp'/);
  for(const op of ['select','insert','update','delete'])assert.ok(migration.includes('for '+op+' to authenticated'));
  assert.doesNotMatch(migration,/to public/);
});
test('PWA: identidad nueva sin almacenar imágenes privadas',()=>{
  assert.match(sw,/perci-shell-v1\.13\.1-safari-jpeg/);
  assert.match(sw,/profile-avatar\.js\?v=1\.13\.1/);
  assert.match(html,/app\.js\?v=1\.13\.1/);
  assert.doesNotMatch(sw,/perci-avatars-qa/);
});
