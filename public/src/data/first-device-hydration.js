/**
 * Perci QA v1.7.4: recuperacion del primer dispositivo sin escrituras remotas.
 * Solo es seguro adoptar la nube si el dispositivo NO tiene datos personales,
 * borradores, operaciones pendientes ni intenciones de eliminacion.
 */
const allowedThemes=new Set(['dark','light','system']);
const allowedFocus=new Set(['gym','others','both']);
const list=['routines','records','habits'];
const copy=value=>JSON.parse(JSON.stringify(value));

export function planFirstDeviceRestore({local,remote,pending=null,deleteIntents=null}){
  if(!local || typeof local!=='object' || !remote || typeof remote!=='object' || pending)return null;
  if(local.draft || local.demo!==false || !list.every(k=>Array.isArray(local[k])&&local[k].length===0))return null;
  if(!local.checks || typeof local.checks!=='object' || Array.isArray(local.checks) || Object.keys(local.checks).length)return null;
  if(['routines','records','habits'].some(k=>(deleteIntents?.[k]||[]).length))return null;
  if(!list.every(k=>Array.isArray(remote[k])))return null;
  if(!remote.checks || typeof remote.checks!=='object' || Array.isArray(remote.checks))return null;
  const remoteHasData=list.some(k=>remote[k].length>0) || Object.values(remote.checks).some(Boolean);
  if(!remoteHasData && remote.onboardSeen!==true)return null;
  // No permitir que un dato remoto malformado se convierta en estado persistido.
  for(const k of list){
    const ids=new Set();
    for(const item of remote[k]){
      if(!item || typeof item!=='object' || typeof item.id!=='string' || !item.id || ids.has(item.id))return null;
      ids.add(item.id);
      if(k==='routines' && !Array.isArray(item.exercises))return null;
    }
  }
  const cleaned={...local,demo:false,version:Math.max(3,Number(local.version)||3),
    routines:copy(remote.routines),records:copy(remote.records),habits:copy(remote.habits),checks:copy(remote.checks),
    onboardSeen:remote.onboardSeen===true||remoteHasData,draft:null};
  if(allowedThemes.has(remote.theme))cleaned.theme=remote.theme;
  if(allowedFocus.has(remote.focus))cleaned.focus=remote.focus;
  return cleaned;
}
