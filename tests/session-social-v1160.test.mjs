import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../public/src/app.js'),sw=read('../public/sw.js');
const code=app.slice(app.indexOf('function activeSessionMs('),app.indexOf('function beginSession('));
const {activeSessionMs,activeSessionClock}=vm.runInNewContext(code+';({activeSessionMs,activeSessionClock})');
test('sesión: cronómetro avanza sin acumular pausas',()=>{
  const d={startedAt:100000,pausedTotalMs:0,pausedAt:null};
  assert.equal(activeSessionClock(d,161000),'01:01');
  d.pausedAt=161000;
  assert.equal(activeSessionMs(d,280000),61000);
  d.pausedTotalMs=119000;d.pausedAt=null;
  assert.equal(activeSessionClock(d,340000),'02:01');
});
test('sesión: borradores antiguos y tiempos imposibles no generan números negativos',()=>{
  assert.equal(activeSessionClock({startedAt:100000},100000),'00:00');
  assert.equal(activeSessionMs({startedAt:100000},90000),0);
  assert.equal(activeSessionClock({startedAt:100000,pausedTotalMs:0},3700000),'01:00:00');
});
test('sesión: pausa/reanuda, duración final descontada y actualización visible',()=>{
  assert.match(app,/case 'pauseSession':/);
  assert.match(app,/case 'resumeSession':/);
  assert.match(app,/pausedTotalMs.*now-Number\(draft\.pausedAt\)/);
  assert.match(app,/minutes:Math\.max\(1,Math\.round\(activeSessionMs\(d\)\/60000\)\)/);
  assert.match(app,/data-active-session-clock/);
  assert.match(app,/setInterval\(refreshActiveSessionClock,1000\)/);
});
test('social: navegación, sesión autenticada y no acceso directo a datos de entrenamiento',()=>{
  assert.match(app,/\['social','Amigos'\]/);
  assert.match(app,/function renderSocial\(/);
  assert.match(app,/\/api\/social/);
  assert.match(app,/Enviar solicitud/);
  assert.match(app,/Solicitudes recibidas/);
  assert.match(app,/case 'socialAccept':/);
  assert.match(sw,/perci-shell-v1\.16\.1-social-search-layout/);
});
