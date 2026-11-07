import {queueSnapshot,readOutbox,isOfflineNow} from './data/offline-outbox.js?v=1.6.2';
/** Percí v1.2: cuenta obligatoria, sesión del servidor + acceso offline previamente autorizado.
 * La credencial offline solo recuerda un usuario autenticado en este dispositivo;
 * NO sustituye cifrado local ni autentica contra Supabase sin conexión.
 */
export const account = {
  configured:false,ready:false,authenticated:false,offline:false,user:null,busy:false,
  syncing:false,linked:false,syncPaused:false,syncFailed:false,foreignOwner:false,message:'',error:'',lastSync:null,
  mode:'login',pendingEmail:''
};
const OFFLINE_GRANT_KEY = 'perci_offline_trusted_user_v09';
const LEGACY_OWNER_KEY = 'perci_cloud_owner_v08';
// Supabase confirms email outside our cookie-based login flow. Return to the
// normal login screen without persisting access/refresh tokens from URL fragments.
const emailReturn = (() => {
  try {
    const loc = window.location;
    if (!loc) return {requested:false,failed:false};
    const requested = new URLSearchParams(loc.search || '').get('auth') === 'verified';
    const fragment = new URLSearchParams(String(loc.hash || '').replace(/^#/, ''));
    const failed = fragment.has('error') || fragment.has('error_code');
    if (requested || fragment.has('access_token') || fragment.has('refresh_token') || failed) {
      window.history?.replaceState?.(null, '', loc.pathname || '/');
    }
    return {requested, failed};
  } catch { return {requested:false,failed:false}; }
})();
let notify=()=>{};
let syncTimer=null;
let requestSafeSync=()=>{};
export function onSyncRequested(fn){requestSafeSync=fn;}
export function onAccountChange(fn){notify=fn;}
function update(changes){Object.assign(account,changes);notify({...account});}
export const displayName=user=>{
  const name=(user?.name||user?.user_metadata?.full_name||'').trim();
  return name || (user?.email ? user.email.split('@')[0] : 'Mi cuenta');
};
export const accountInitial=user=>{
  const name=(user?.name||user?.user_metadata?.full_name||'').trim();
  return name ? name[0].toLocaleUpperCase('es-AR') : '';
};
function savedGrant(){
  try{
    const obj=JSON.parse(localStorage.getItem(OFFLINE_GRANT_KEY)||'null');
    return obj && typeof obj.id==='string' && /^[0-9a-f-]{36}$/.test(obj.id) && typeof obj.email==='string' ? obj : null;
  }catch{return null;}
}
function rememberUser(user){
  try{localStorage.setItem(OFFLINE_GRANT_KEY, JSON.stringify({id:user.id,email:user.email,name:user.name||'',validatedAt:new Date().toISOString()}));}catch{}
}
function forgetUser(){try{localStorage.removeItem(OFFLINE_GRANT_KEY);}catch{}}
const syncMarker=id=>`perci_cloud_linked_v09_${id}`;
const pendingMarker=id=>`perci_pending_sync_v09_${id}`;
function linked(user){
  if(!user)return false;
  try {return localStorage.getItem(syncMarker(user.id))==='1' || localStorage.getItem(LEGACY_OWNER_KEY)===user.id;}catch{return false;}
}
export function hasAccountConflict(){return false;} // Los registros usan almacenamiento separado por ID de cuenta.
export function changeAccountMode(mode){
  if(!['login','register'].includes(mode))return;
  update({mode,error:'',message:'',pendingEmail:''});
}
class NetworkError extends Error{}
async function request(path,body=undefined){
  const options={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
  if(body!==undefined){options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
  let response;
  try{response=await fetch(path,options);}catch{throw new NetworkError('No se pudo contactar al servidor.');}
  let payload;
  try{payload=await response.json();}catch{throw new Error('El servidor respondió de forma inesperada.');}
  if(!response.ok){
    const message=payload?.error||'No se pudo completar la operación.';
    if([502,503,504].includes(response.status))throw new NetworkError(message);
    const err=new Error(message);
    err.status=response.status;
    throw err;
  }
  return payload;
}
export async function initAccount(){
  try{
    const data=await request('/api/auth/session');
    if(data.authenticated&&data.user){
      rememberUser(data.user);
      update({ready:true,configured:true,authenticated:true,offline:false,user:data.user,
        linked:linked(data.user),syncFailed:false,error:'',message:''});
    }else{
      // La respuesta explícita del servidor invalida la autorización offline previa.
      forgetUser();
      update({ready:true,configured:!!data.configured,authenticated:false,offline:false,
        user:null,linked:false,syncFailed:false,mode:emailReturn.requested?'login':account.mode,
        error:emailReturn.requested&&emailReturn.failed?'No pudimos confirmar el correo. Abrí el enlace de verificación otra vez o solicitá uno nuevo.':'',
        message:emailReturn.requested&&!emailReturn.failed?'Si ya confirmaste tu correo, iniciá sesión con tu contraseña.':''});
    }
  }catch(error){
    // Ante caída de red/servidor permitimos trabajo en este dispositivo de confianza.
    // Nunca habilitamos a una cuenta que no se haya autenticado previamente.
    const grant=savedGrant();
    if(grant && error instanceof NetworkError){
      update({ready:true,configured:true,authenticated:true,offline:true,user:grant,
        linked:linked(grant),error:'',message:'Sin conexión. Podés entrenar y registrar avances. Se sincronizarán cuando vuelva el servicio.'});
    }else{
      update({ready:true,configured:true,authenticated:false,offline:false,user:null,
        linked:false,error:error.message||'No se pudo comprobar tu sesión. Conectate para ingresar.'});
    }
  }
}
async function action(fn){
  if(account.busy)return;
  update({busy:true,error:'',message:''});
  try{await fn();}catch(error){update({error:error.message||String(error)});}
  finally{update({busy:false});}
}
const emailOK=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export function login(email,password){return action(async()=>{
  email=String(email||'').trim();
  if(!emailOK(email))throw new Error('Ingresá una dirección de correo válida.');
  if(!password)throw new Error('Ingresá tu contraseña.');
  const data=await request('/api/auth/login',{email,password});
  rememberUser(data.user);
  update({authenticated:true,offline:false,user:data.user,linked:linked(data.user),mode:'login',
    message:'¡Bienvenido a Percí!',syncFailed:false,error:''});
});}
export function signup(name,email,password,confirmation){return action(async()=>{
  name=String(name||'').trim().replace(/\s+/g,' ');
  email=String(email||'').trim();
  if(name.length<2 || name.length>70)throw new Error('Escribí tu nombre (entre 2 y 70 caracteres).');
  if(!emailOK(email))throw new Error('Ingresá una dirección de correo válida.');
  if(typeof password!=='string'||password.length<8)throw new Error('Tu contraseña necesita al menos 8 caracteres.');
  if(password!==confirmation)throw new Error('Las contraseñas no coinciden.');
  const data=await request('/api/auth/signup',{name,email,password});
  if(data.authenticated&&data.user){
    rememberUser(data.user);
    update({authenticated:true,offline:false,user:data.user,linked:linked(data.user),mode:'login',message:'Tu cuenta está lista.'});
  }else{
    update({mode:'confirm',pendingEmail:email,message:data.message||'Revisá tu correo y confirmá tu cuenta.'});
  }
});}
export function logout(){return action(async()=>{
  if(account.offline)throw new Error('Conectate a internet para cerrar tu sesión de forma segura.');
  await request('/api/auth/logout',{});
  if(syncTimer)clearTimeout(syncTimer);
  forgetUser();
  update({authenticated:false,user:null,offline:false,linked:false,mode:'login',
    syncFailed:false,pendingEmail:'',message:'Cerraste sesión. Tus entrenamientos permanecen guardados en este dispositivo.'});
});}
export function markLinked(userId){
  try{localStorage.setItem(syncMarker(userId),'1');localStorage.removeItem(pendingMarker(userId));}catch{}
  if(account.user?.id===userId)update({linked:true});
}
export function linkAccount(snapshot){return action(async()=>{
  if(!account.authenticated||!account.user)throw new Error('Primero iniciá sesión.');
  if(isOfflineNow(account))throw new Error('Guardamos tus cambios como borrador. Volvé a conectarte para sincronizar.');
  queueSnapshot(account.user.id,snapshot);
  await requestSafeSync(); // Nunca enviar una copia sin comparar primero la nube.
});}
export function scheduleAccountSync(snapshot){
  if(!account.authenticated||!account.user)return;
  try{queueSnapshot(account.user.id,snapshot);}catch(error){
    account.error='Sin espacio para guardar el borrador local. Exportá una copia JSON antes de cerrar.';
    console.error('Percí: almacenamiento local no disponible',error?.name);
    return;
  }
  // Las sesiones en progreso jamás se envían como registros finalizados.
  if(snapshot?.draft||isOfflineNow(account)||account.busy || (account.syncPaused&&!account.syncFailed))return;
  if(syncTimer)clearTimeout(syncTimer);
  // Reintentar un fallo previo, sin levantar una pausa por conflicto.
  const uid=account.user.id;
  syncTimer=setTimeout(()=>{
    if(account.authenticated&&account.user?.id===uid&&!isOfflineNow(account)&&
      (!account.syncPaused||account.syncFailed)&&readOutbox(uid))requestSafeSync();
  },1300);
}
export function resumePendingSync(snapshot){
  if(!account.authenticated||!account.user||isOfflineNow(account)||account.syncPaused||snapshot?.draft)return;
  if(readOutbox(account.user.id))requestSafeSync();
}
export const fetchCloudData=()=>request('/api/cloud/data');
export const retrySync=linkAccount;
// Detectar recuperación de internet y verificar la cookie antes de reactivar sync.
window.addEventListener('online',()=>{if(account.authenticated) initAccount().catch(()=>{});});
window.addEventListener('offline',()=>{if(account.authenticated) update({offline:true,message:'Sin conexión. Los cambios quedan como borradores en este dispositivo.'});});
/** Solo el orquestador de app.js puede llamarlo, después de comparar tres vías. */
export const syncCloudSnapshot=(snapshot, expected)=>request('/api/cloud/sync',{snapshot, expected});
export const deleteCloudRecords=records=>request('/api/cloud/delete',{records});
export const deleteCloudEntities=deletions=>request('/api/cloud/delete',deletions);
