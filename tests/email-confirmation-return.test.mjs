import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: k => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
const calls=[];
globalThis.window = {
  location: {search:'?auth=verified',pathname:'/',hash:'#access_token=SECRET&refresh_token=SECRET&token_type=bearer'},
  history: {replaceState(...args){calls.push(args)}},
  addEventListener(){}
};
const {account, initAccount} = await import('../public/src/account.js?v=1.7.6');
const {renderAuthGate} = await import('../public/src/account-ui.js?v=1.7.6');

test('v1.6.2: retorno de confirmación va a login sin incorporar credenciales del fragmento',async()=>{
  assert.equal(calls.length,1);
  assert.equal(calls[0][2],'/');
  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({configured:true,authenticated:false,user:null})});
  await initAccount();
  assert.equal(account.mode,'login');
  assert.equal(account.authenticated,false);
  assert.match(account.message,/confirmaste tu correo/);
  assert.match(renderAuthGate(),/INICIAR SESIÓN/);
  assert.match(renderAuthGate(),/iniciá sesión con tu contraseña/);
  assert.equal([...store.values()].some(v=>v.includes('SECRET')),false);
});
