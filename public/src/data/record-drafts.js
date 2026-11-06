/** Percí v1.3: borradores personales de registros finalizados.
 * Se conservan sólo en este dispositivo, nunca se suben como actividad finalizada.
 */
const validUid=id=>typeof id==='string' && /^[0-9a-f-]{36}$/i.test(id);
const key=uid=>`perci_record_drafts_v13_${uid}`;
const copy=x=>JSON.parse(JSON.stringify(x));
export function listRecordDrafts(uid){
  if(!validUid(uid))return [];
  try {const items=JSON.parse(localStorage.getItem(key(uid))||'[]');return Array.isArray(items)?items.filter(x=>x?.record?.id):[];}catch{return [];}
}
export function saveRecordDraft(uid,record){
  if(!validUid(uid)||!record?.id)throw Error('Borrador inválido');
  const items=listRecordDrafts(uid).filter(x=>x.record.id!==record.id);
  items.unshift({record:copy(record),savedAt:new Date().toISOString()});
  localStorage.setItem(key(uid),JSON.stringify(items.slice(0,30)));
  return items[0];
}
export function removeRecordDraft(uid,id){
  if(!validUid(uid))throw Error('Usuario inválido');
  const remaining=listRecordDrafts(uid).filter(x=>x.record.id!==id);
  localStorage.setItem(key(uid),JSON.stringify(remaining));
}
export function findRecordDraft(uid,id){return listRecordDrafts(uid).find(x=>x.record.id===id)?.record||null;}
