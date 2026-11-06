import test from 'node:test';
import assert from 'node:assert/strict';
const store=new Map();
globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
globalThis.window={addEventListener(){}};
const {account,initAccount,signup,login,logout,changeAccountMode,accountInitial} = await import('../public/src/account.js?v=1.5');
const {renderAuthGate} = await import('../public/src/account-ui.js');
const user={id:'d7396485-4017-4caa-a4be-2e8f73681e6c',email:'valen@example.com',name:'Valentín'};
const fakeResponse=(data,status=200)=>({ok:status<400,status,json:async()=>data});
test('ingreso y registro muestran formularios distintos antes de la app',async()=>{
  globalThis.fetch=async()=>fakeResponse({configured:true,authenticated:false,user:null});
  await initAccount();
  assert.equal(account.ready,true);
  assert.equal(account.authenticated,false);
  assert.match(renderAuthGate(),/INICIAR SESIÓN/);
  assert.equal((renderAuthGate().match(/<input /g)||[]).length,2);
  changeAccountMode('register');
  const html=renderAuthGate();
  assert.match(html,/Crear mi cuenta/);
  assert.match(html,/Tu nombre/);
  assert.match(html,/Repetí la contraseña/);
  assert.equal((html.match(/<input /g)||[]).length,4);
});
test('validacion impide registro con contraseñas distintas',async()=>{
  let calls=0;globalThis.fetch=async()=>{calls++;return fakeResponse({})};
  await signup('Valentín','valen@example.com','password123','different123');
  assert.match(account.error,/no coinciden/);
  assert.equal(calls,0);
});
test('registro envia el nombre y requiere confirmar email',async()=>{
  let body;globalThis.fetch=async(_path,opts)=>{body=JSON.parse(opts.body);return fakeResponse({authenticated:false,message:'Confirmá tu correo.'})};
  await signup('Valentín','valen@example.com','password123','password123');
  assert.equal(body.name,'Valentín');
  assert.equal(account.mode,'confirm');
  assert.equal(account.authenticated,false);
  assert.match(renderAuthGate(),/Confirmá tu correo/);
});
test('login habilita sesion, avatar usa nombre, y logout la revoca',async()=>{
  globalThis.fetch=async(path)=>fakeResponse(path==='/api/auth/login'?{authenticated:true,user}:{authenticated:false});
  await login('valen@example.com','password123');
  assert.equal(account.authenticated,true);
  assert.equal(accountInitial(account.user),'V');
  assert.equal(JSON.parse(store.get('perci_offline_trusted_user_v09')).id,user.id);
  await logout();
  assert.equal(account.authenticated,false);
  assert.equal(store.has('perci_offline_trusted_user_v09'),false);
});
test('sin servidor, solo el usuario previamente autenticado puede acceder offline',async()=>{
  globalThis.fetch=async()=>fakeResponse({configured:true,authenticated:false});
  await initAccount();
  assert.equal(account.authenticated,false);
  globalThis.fetch=async(path)=>fakeResponse({authenticated:true,user});
  await login('valen@example.com','password123');
  globalThis.fetch=async()=>{throw Error('offline')};
  await initAccount();
  assert.equal(account.authenticated,true);
  assert.equal(account.offline,true);
  assert.equal(account.user.name,'Valentín');
});
test('aislamiento local por identificador de usuario',async()=>{
  const {storage,readUserState,writeUserState}=await import('../public/src/data/repository.js');
  const u2='5b3e7ebf-884b-4f5f-857c-fc4982307db5';
  writeUserState(user.id,{routines:[{name:'Dia 1 Full Body'}]});
  writeUserState(u2,{routines:[{name:'Otra rutina'}]});
  assert.equal(readUserState(user.id).routines[0].name,'Dia 1 Full Body');
  assert.equal(readUserState(u2).routines[0].name,'Otra rutina');
  storage.activateUser(u2);storage.write({routines:[{name:'Nueva'}]});
  assert.equal(readUserState(user.id).routines[0].name,'Dia 1 Full Body');
});

test('nuevo perfil separado recibe onboarding despues de autenticarse',async()=>{
  const {getInitialView}=await import('../public/src/domain/startup-route.js');
  assert.equal(getInitialView({version:3,demo:false,onboardSeen:false,routines:[],records:[],habits:[]}), 'onboard');
  assert.equal(getInitialView({version:3,demo:false,onboardSeen:true,routines:[],records:[],habits:[]}), 'home');
});
