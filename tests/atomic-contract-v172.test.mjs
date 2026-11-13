import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = (path) => fs.readFileSync(new URL(path, import.meta.url),'utf8');

test('v1.7.6 PWA envía un único commit con borrados atómicos',()=>{
  const acc=source('../public/src/account.js');
  const app=source('../public/src/app.js');
  assert.match(acc,/syncCloudSnapshot=\(snapshot, expected, deletions=\{\}\)/);
  assert.match(acc,/\{snapshot,expected,deletions,atomic:true\}/);
  assert.match(app,/await syncCloudSnapshot\(\{\.\.\.result\.snapshot,draft:null\},remote,deletions\)/);
  assert.doesNotMatch(app,/await deleteCloudEntities\(/);
  assert.match(app,/confirmed\?\.revision!==committed\.revision/);
  assert.match(app,/clearOutboxIfCurrent\(uid,revision\)/);
});

test('v1.7.6 shell no mezcla versiones',()=>{
  const html=source('../public/index.html');
  const sw=source('../public/sw.js');
  const app=source('../public/src/app.js');
  const account=source('../public/src/account.js');
  for(const content of [html,sw,app,account]){
    assert.doesNotMatch(content,/v=1\.6\.4/);
    assert.match(content,/v=1\.7\.6/);
  }
  assert.match(sw,/perci-shell-v1\.10\.0-historical-sets/);
});
