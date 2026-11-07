import {loadPublicConfig,storePublicConfig,SDK_URL,CLOUD_CONFIG_KEY} from './config.js?v=1.6.4';
import {prepareCloudImport,performCloudImport} from './migration.js?v=1.6.4';

export const cloud={configured:false,connecting:false,busy:false,authenticated:false,email:'',userId:null,message:'',error:'',lastImport:null,publicHost:''};
let client=null;
let onChange=()=>{};
const emit=()=>onChange({...cloud});
function notice(message,error=false){cloud.message=error?'':message;cloud.error=error?message:'';emit();}
export function subscribeCloud(fn){onChange=fn;}
export function getCloudConfig(){return loadPublicConfig();}

async function connectWithConfig(config){
  cloud.configured=true;cloud.connecting=true;cloud.publicHost=new URL(config.url).host;cloud.error='';emit();
  try{
    const pkg=await import(/* @vite-ignore */ SDK_URL);
    const created=pkg.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:'perci-auth-v07'}});
    client=created;
    created.auth.onAuthStateChange((event,session)=>{
      // Evitar llamadas a la API dentro del callback de Auth (bloqueos por lock interno).
      cloud.authenticated=Boolean(session?.user);
      cloud.userId=session?.user?.id??null;
      cloud.email=session?.user?.email??'';
      emit();
    });
    const {data,error}=await created.auth.getUser();
    if(error && error.name!=='AuthSessionMissingError')throw error;
    cloud.authenticated=Boolean(data?.user);cloud.userId=data?.user?.id??null;cloud.email=data?.user?.email??'';
    cloud.message='Supabase DEV configurado. La app continúa guardando tus rutinas localmente.';
  }catch(err){client=null;cloud.error=`No se pudo conectar a Supabase: ${err.message||err}. Tu app local sigue funcionando.`;cloud.authenticated=false;cloud.userId=null;cloud.email='';}
  finally{cloud.connecting=false;emit();}
}
export async function initCloud(){const config=loadPublicConfig();if(config)await connectWithConfig(config);}
export async function configureCloud(url,key){
  // Se valida y conecta antes de aceptar como configuración final.
  const config=storePublicConfig(url,key);
  if(client){await client.auth.signOut({scope:'local'}).catch(()=>{});} // Evita reutilizar una sesión de otro proyecto.
  client=null;cloud.authenticated=false;cloud.userId=null;cloud.email='';
  await connectWithConfig(config);
}
async function withBusy(fn){
  if(cloud.busy) return;
  cloud.busy=true;cloud.error='';cloud.message='';emit();
  try{await fn();}
  catch(err){notice(err.message||'No se pudo completar la operación.',true);}
  finally{cloud.busy=false;emit();}
}
async function requireClient(){if(!client)throw new Error('Primero configurá Supabase DEV y comprobá la conexión.');return client;}
export const login=(email,password)=>withBusy(async()=>{
  const c=await requireClient();
  const {error}=await c.auth.signInWithPassword({email:email.trim(),password});
  if(error)throw error;
  const user=await verifyUser(c);
  cloud.authenticated=true;cloud.userId=user.id;cloud.email=user.email||email.trim();notice('Sesión iniciada en Supabase DEV. Los datos de esta app siguen siendo locales.');
});
export const signup=(email,password)=>withBusy(async()=>{
  if(password.length<8)throw new Error('La contraseña debe tener al menos 8 caracteres.');
  const c=await requireClient();
  const {data,error}=await c.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
  if(error)throw error;
  if(data?.session){const user=await verifyUser(c);cloud.authenticated=true;cloud.userId=user.id;cloud.email=user.email||email.trim();notice('Cuenta creada e inicio de sesión activo.');}
  else notice('Si se creó la cuenta, vas a recibir un correo para confirmarla. Revisá tu casilla antes de ingresar.');
});
export const logout=()=>withBusy(async()=>{
  const c=await requireClient();
  const {error}=await c.auth.signOut();if(error)throw error;
  cloud.authenticated=false;cloud.userId=null;cloud.email='';notice('Sesión cerrada. Tus datos locales permanecen intactos.');
});
async function verifyUser(c){const {data,error}=await c.auth.getUser();if(error||!data?.user)throw new Error('No se pudo verificar la sesión. Volvé a ingresar.');return data.user;}
export const verifyCloud=()=>withBusy(async()=>{
  const c=await requireClient();const u=await verifyUser(c);
  const {data,error}=await c.from('perci_routines').select('id').eq('user_id',u.id).limit(1);
  if(error)throw new Error(`No se pudo consultar perci_routines: ${error.message}. Comprobá el SQL y RLS de Supabase DEV.`);
  notice('Lectura de tus rutinas remotas verificada. Esto no reemplaza el test RLS con dos usuarios.');
});
export function preflightCloud(snapshot,choices){return prepareCloudImport(snapshot,choices);}
export const migrateCloud=(snapshot,choices)=>withBusy(async()=>{
  const c=await requireClient();const u=await verifyUser(c);
  const bindingKey='perci_cloud_import_owner_v07';
  const priorOwner=localStorage.getItem(bindingKey);
  if(priorOwner && priorOwner!==u.id)throw new Error('Esta copia local ya se importó a otra cuenta. Para evitar mezclar datos privados usá un perfil separado de Safari.');
  // Antes de cualquier escritura se genera un checkpoint independiente, sin tocar backup previo.
  const checkpoint='perci_cloud_import_checkpoint_v07';
  if(!localStorage.getItem(checkpoint))localStorage.setItem(checkpoint,JSON.stringify(snapshot));
  const result=await performCloudImport(c,u.id,snapshot,choices);
  localStorage.setItem(bindingKey,u.id);
  cloud.lastImport=result;
  notice(`Importación leída y verificada en nube: ${result.routines} rutinas, ${result.exercises} ejercicios, ${result.records} actividades, ${result.habits} hábitos. Percí todavía guarda localmente; la sincronización continua será otra etapa.`);
});
export function cloudError(err){notice(err?.message||String(err)||'No se pudo completar la acción.',true);}
export function clearCloudConfig(){
  if(cloud.authenticated)throw new Error('Cerrá sesión antes de cambiar de proyecto.');
  localStorage.removeItem(CLOUD_CONFIG_KEY);
  client=null;
  Object.assign(cloud,{configured:false,connecting:false,authenticated:false,userId:null,email:'',publicHost:'',lastImport:null,message:'Configuración de Supabase desvinculada. Datos locales intactos.',error:''});
  emit();
}
