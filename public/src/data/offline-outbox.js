/** Percí v1.2: cola de cambios por cuenta, persistente en el navegador.
 * No contiene tokens ni contraseñas. El estado offline en localStorage NO está cifrado.
 * Los borradores de sesión / editor no se envían al servidor hasta quedar completos.
 */
import {cleanImportedState} from './import-cleanup.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const items=['routines','records','habits'];
const validUid=id=>typeof id==='string' && /^[0-9a-f-]{36}$/i.test(id);
const key=(prefix,uid)=>`${prefix}_${uid}`;
const outboxKey=uid=>key('perci_outbox_v12',uid);
const baselineKey=uid=>key('perci_remote_baseline_v12',uid);
const editorKey=uid=>key('perci_routine_editor_v12',uid);
const deletesKey=uid=>key('perci_record_deletes_v13',uid);
const safeRead=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function readOutbox(uid){return validUid(uid)?safeRead(outboxKey(uid)):null;}
/** Guardar intención explícita del usuario, incluso si no existía baseline remoto. */
export function listRecordDeletes(uid){
  if(!validUid(uid))return [];
  const ids=safeRead(deletesKey(uid));
  return Array.isArray(ids)?ids.filter(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x)):[];
}
export function markRecordDeleted(uid,id){
  if(!validUid(uid)||typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error('Registro inválido');
  const ids=listRecordDeletes(uid);
  if(!ids.includes(id))ids.push(id);
  localStorage.setItem(deletesKey(uid),JSON.stringify(ids));
}
export function clearRecordDeletes(uid,ids){
  if(!validUid(uid))return;
  const omit=new Set(ids);
  localStorage.setItem(deletesKey(uid),JSON.stringify(listRecordDeletes(uid).filter(id=>!omit.has(id))));
}
export function cancelRecordDelete(uid,id){clearRecordDeletes(uid,[id]);}
export function getBaseline(uid){return validUid(uid)?safeRead(baselineKey(uid)):null;}
export function saveBaseline(uid,remote){if(!validUid(uid))throw Error('Usuario inválido');localStorage.setItem(baselineKey(uid),JSON.stringify(remote));}
export function queueSnapshot(uid,snapshot){
  if(!validUid(uid))throw Error('Usuario inválido');
  const prior=readOutbox(uid);
  const next={version:1,revision:(prior?.revision||0)+1,
    base:prior ? prior.base : getBaseline(uid),
    snapshot:copy(snapshot),createdAt:prior?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  localStorage.setItem(outboxKey(uid),JSON.stringify(next));
  return next;
}
export function rebaseOutbox(uid,remote,merged){
  if(!validUid(uid))throw Error('Usuario inválido');
  const prior=readOutbox(uid);
  const next={version:1,revision:(prior?.revision||0)+1,base:copy(remote),snapshot:copy(merged),
    createdAt:prior?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  localStorage.setItem(outboxKey(uid),JSON.stringify(next));
  return next;
}
export function clearOutboxIfCurrent(uid,revision){
  if(readOutbox(uid)?.revision!==revision)return false;
  localStorage.removeItem(outboxKey(uid));return true;
}
export function readRoutineEditor(uid){
  if(!validUid(uid))return null;
  const value=safeRead(editorKey(uid));
  return value&&Array.isArray(value.exercises)&&typeof value.name==='string'?value:null;
}
export function saveRoutineEditor(uid,editor){if(!validUid(uid))return;localStorage.setItem(editorKey(uid),JSON.stringify({...copy(editor),savedAt:new Date().toISOString()}));}
export function clearRoutineEditor(uid){if(validUid(uid))localStorage.removeItem(editorKey(uid));}
export function isOfflineNow(account){return Boolean(account?.offline)||(typeof navigator!=='undefined'&&navigator.onLine===false);}

function fingerprint(kind,obj){
  if(obj===undefined)return '__missing__';
  if(kind==='routines')return JSON.stringify({name:obj.name,exercises:(obj.exercises||[]).map(e=>({name:e.name,sets:Number(e.sets),reps:Number(e.reps)}))});
  if(kind==='habits')return JSON.stringify({name:obj.name,days:[...(obj.days||[])].sort((a,b)=>a-b),paused:!!obj.paused});
  if(kind==='records')return JSON.stringify({type:obj.type,name:obj.name,date:obj.date,minutes:Number(obj.minutes),
    distance:obj.distance==null?null:Number(obj.distance),setsDone:obj.setsDone==null?null:Number(obj.setsDone),
    volume:obj.volume==null?null:Number(obj.volume),note:obj.note||'',setDetails:(obj.setDetails||[]).map(x=>({exercisePosition:Number(x.exercisePosition),exerciseName:x.exerciseName,setNumber:Number(x.setNumber),reps:Number(x.reps),weight:Number(x.weight),completed:!!x.completed})).sort((a,b)=>a.exercisePosition-b.exercisePosition||a.setNumber-b.setNumber)});
  return JSON.stringify(obj);
}
function normalized(src){
  const clean=cleanImportedState(src||{routines:[],records:[],habits:[],checks:{}});
  if(!clean||items.some(k=>!Array.isArray(clean[k]))||!clean.checks||typeof clean.checks!=='object')throw Error('Datos locales o remotos inválidos.');
  return clean;
}
function entry(map,id){return map.has(id)?map.get(id):undefined;}
/** Merge de tres vías. Los registros borrados explícitamente se eliminan en la API, no por upsert. */
export function planOfflineSync(base,local,remote,prefer=null,deletedRecordIds=[]){
  if(prefer!==null&&!['local','remote'].includes(prefer))throw Error('Elección inválida');
  const before=base==null?null:normalized(base);
  const here=normalized(local),there=normalized(remote);
  const merged={...copy(here),demo:false,onboardSeen:true};
  const conflicts=[],unsupportedDeletes=[],deletions=[];
  const explicitDeleted=new Set(deletedRecordIds);
  for(const kind of items){
    const a=new Map((before?.[kind]||[]).map(x=>[x.id,x]));
    const b=new Map(here[kind].map(x=>[x.id,x]));
    const c=new Map(there[kind].map(x=>[x.id,x]));
    const ids=[...new Set([...b.keys(),...c.keys(),...a.keys()])];
    merged[kind]=[];
    for(const id of ids){
      const old=entry(a,id),loc=entry(b,id),rem=entry(c,id);
      const fl=fingerprint(kind,loc),fr=fingerprint(kind,rem),fo=fingerprint(kind,old);
      // Una eliminación confirmada prevalece sobre el snapshot remoto para este ID.
      // Incluye registros eliminados en v1.2 que siguen en su outbox.
      // Un borrado explícito sigue siendo definitivo aunque otro dispositivo
      // ya haya eliminado el registro: no convertirlo en un conflicto ficticio.
      if(kind==='records' && loc===undefined && (old!==undefined || explicitDeleted.has(id))){
        if(rem!==undefined)deletions.push({kind:'records',id});
        continue;
      }
      const lChanged=old===undefined?loc!==undefined:fl!==fo;
      const rChanged=old===undefined?rem!==undefined:fr!==fo;
      let chosen;
      if(fl===fr)chosen=loc;
      else if(!lChanged)chosen=rem;
      else if(!rChanged)chosen=loc;
      else{
        conflicts.push({kind,id});
        chosen=prefer==='remote'?rem:loc;
      }
      if(old!==undefined&&loc===undefined&&rem!==undefined){
        if(prefer==='remote')chosen=rem; // El usuario decidió recuperar lo borrado desde la nube.
        else unsupportedDeletes.push({kind,id});
      }
      if(chosen!==undefined)merged[kind].push(copy(chosen));
    }
  }
  const oldChecks=before?.checks||{},locChecks=here.checks||{},remChecks=there.checks||{};
  merged.checks={};
  const checkIds=new Set([...Object.keys(oldChecks),...Object.keys(locChecks),...Object.keys(remChecks)]);
  for(const id of checkIds){
    const a=Boolean(oldChecks[id]),b=Boolean(locChecks[id]),c=Boolean(remChecks[id]);
    if(a&&!b&&c&&prefer!=='remote')unsupportedDeletes.push({kind:'checks',id});
    if(a!==b&&a!==c&&b!==c)conflicts.push({kind:'checks',id});
    const value=(a&&!b&&c&&prefer==='remote')?c:(b===c?b:a===b?c:a===c?b:prefer==='remote'?c:b);
    if(value)merged.checks[id]=true;
  }
  return {snapshot:merged,conflicts:prefer?[]:conflicts,unsupportedDeletes,deletions,
    safe:(prefer!==null||conflicts.length===0)&&unsupportedDeletes.length===0};
}
/** Exigir lectura posterior: confirma que lo que escribimos está realmente en Supabase. */
export function verifyRemoteSnapshot(expected,actual,deletions=[]){
  const left=normalized(expected),right=normalized(actual);
  for(const kind of items){
    const remote=new Map(right[kind].map(x=>[x.id,x]));
    for(const x of left[kind])if(fingerprint(kind,x)!==fingerprint(kind,remote.get(x.id)))return false;
  }
  for(const [id,value] of Object.entries(left.checks||{}))if(value&&!right.checks[id])return false;
  for(const item of deletions){
    if(item.kind==='records' && right.records.some(x=>x.id===item.id))return false;
  }
  return true;
}

/** Cuando otro dispositivo eliminó un registro, no resucitar su copia local intacta.
 * Si hubo cambios locales diferentes, los deja para revisión de conflicto.
 */
export function applyRemoteRecordDeletes(base,local,remote){
  if(!base)return {snapshot:local,removed:[]};
  const before=normalized(base),here=normalized(local),there=normalized(remote);
  const old=new Map(before.records.map(x=>[x.id,x]));
  const ids=new Set(there.records.map(x=>x.id));
  const removed=[];
  const records=here.records.filter(x=>{
    const b=old.get(x.id);
    if(b && !ids.has(x.id) && fingerprint('records',x)===fingerprint('records',b)){
      removed.push(x.id);return false;
    }
    return true;
  });
  return {snapshot:{...copy(here),records},removed};
}
