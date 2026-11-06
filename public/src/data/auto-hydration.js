/** Percí 1.1: reconciliación de primera lectura remota, sin sobrescrituras silenciosas.
 * Este módulo NO implementa sincronización bidireccional ni resolución de borrados.
 * Los conflictos de un mismo ID deben resolverse explícitamente en la interfaz.
 */
import { cleanImportedState } from './import-cleanup.js';

const groups = ['routines','records','habits'];
const own = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
const copy = value => JSON.parse(JSON.stringify(value));
function fingerprint(kind,item){
  if(kind==='routines')return JSON.stringify({name:item.name,exercises:(item.exercises||[]).map(e=>({name:e.name,sets:Number(e.sets),reps:Number(e.reps)}))});
  if(kind==='habits')return JSON.stringify({name:item.name,days:[...(item.days||[])].sort((a,b)=>a-b),paused:!!item.paused});
  const result={type:item.type,name:item.name,date:item.date,minutes:Number(item.minutes),note:item.note||''};
  for(const [field] of [['distance'],['setsDone'],['volume']])if(item[field]!=null)result[field]=Number(item[field]);
  result.setDetails=(item.setDetails||[]).map(x=>({exercisePosition:Number(x.exercisePosition),exerciseName:x.exerciseName,setNumber:Number(x.setNumber),reps:Number(x.reps),weight:Number(x.weight),completed:!!x.completed})).sort((a,b)=>a.exercisePosition-b.exercisePosition||a.setNumber-b.setNumber);
  return JSON.stringify(result);
}
export function hasPersonalData(s){
  const c=cleanImportedState(s);
  return !!c && (groups.some(k=>Array.isArray(c[k])&&c[k].length>0) || Object.values(c.checks||{}).some(Boolean));
}
function validate(snapshot){
  if(!snapshot || groups.some(k=>!Array.isArray(snapshot[k])) || !snapshot.checks || typeof snapshot.checks!=='object' || Array.isArray(snapshot.checks))throw Error('El respaldo remoto no tiene el formato esperado.');
  for(const k of groups){
    const ids=new Set();
    for(const item of snapshot[k]){
      if(!item || typeof item.id!=='string' || !item.id || ids.has(item.id))throw Error('El respaldo remoto contiene identificadores inválidos o repetidos.');
      ids.add(item.id);
      if(k==='routines' && !Array.isArray(item.exercises))throw Error('Una rutina remota no tiene ejercicios válidos.');
    }
  }
}

/** prefer: null means defer conflicting objects, otherwise 'local' | 'remote'. */
export function reconcileCloudSnapshot(local,remote,prefer=null){
  validate(remote);
  const cleaned=cleanImportedState(local||{routines:[],records:[],habits:[],checks:{}});
  validate(cleaned);
  if(!['local','remote',null].includes(prefer))throw Error('Preferencia desconocida');
  const conflicts=[];
  const merged={...copy(cleaned),demo:false,onboardSeen:true};
  let imported=0, keptLocal=0;
  for(const k of groups){
    const other=new Map(remote[k].map(item=>[item.id,item]));
    const out=[];
    for(const item of cleaned[k]){
      const match=other.get(item.id);
      if(!match){out.push(copy(item));keptLocal++;continue;}
      other.delete(item.id);
      const same=fingerprint(k,item)===fingerprint(k,match);
      if(!same)conflicts.push({group:k,id:item.id});
      out.push(copy(!same&&prefer==='remote'?match:item));
    }
    for(const item of other.values()){out.push(copy(item));imported++;}
    merged[k]=out;
  }
  merged.checks={...(cleaned.checks||{})};
  for(const [key,value] of Object.entries(remote.checks||{})){
    if(own(merged.checks,key) && Boolean(merged.checks[key])!==Boolean(value)){
      conflicts.push({group:'checks',id:key});
      if(prefer==='remote')merged.checks[key]=value;
    }else merged.checks[key]=value;
  }
  const cloudHasData=hasPersonalData(remote);
  const localHasData=hasPersonalData(cleaned);
  if(!cloudHasData)return {status:'empty-cloud',snapshot:copy(cleaned),conflicts:[],imported:0,keptLocal};
  if(conflicts.length && prefer===null)return {status:'conflict',snapshot:null,conflicts,imported,keptLocal};
  if(!localHasData)return {status:'restored',snapshot:merged,conflicts:[],imported,keptLocal};
  return {status:conflicts.length?'resolved':imported?'merged':'current',snapshot:merged,conflicts:[],imported,keptLocal};
}
