import {previewLocalMigration, clientId} from '../data/migration-preflight.js?v=1.6.3';

const kinds = ['routines','records','habits'];
export function prepareCloudImport(snapshot, selection={routines:true,records:false,habits:false}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Datos locales inválidos.');
  const choices = Object.fromEntries(kinds.map(k=>[k,selection[k]===true]));
  if (!Object.values(choices).some(Boolean)) throw new Error('Elegí al menos un grupo de datos.');
  if (snapshot.draft) throw new Error('Hay un entrenamiento en curso. Finalizalo antes de importar.');
  const subset = {
    ...snapshot,
    routines:choices.routines ? snapshot.routines : [],
    records:choices.records ? snapshot.records : [],
    habits:choices.habits ? snapshot.habits : [],
    checks:choices.habits ? snapshot.checks : {},
    draft:null,
  };
  const report=previewLocalMigration(subset);
  if (!report.ready) throw new Error(report.errors.slice(0,4).join(' '));
  return {selection:choices,subset,report};
}

function ensureError(error,context){ if(error) throw new Error(`${context}: ${error.message || error}`); }
function rows(result,context){ensureError(result.error,context);return result.data??[];}
async function insertIgnore(client, table, data, conflict) {
  if (!data.length) return;
  // No sobrescribir jamás un registro remoto que ya exista con el mismo client_id.
  const result=await client.from(table).upsert(data,{onConflict:conflict,ignoreDuplicates:true});
  ensureError(result.error,`No se pudo importar ${table}`);
}
async function retrieve(client,table,userId,ids) {
  if (!ids.length)return [];
  const found=[];
  for(let i=0;i<ids.length;i+=90){
    const group=ids.slice(i,i+90);
    found.push(...rows(await client.from(table).select('id,client_id').eq('user_id',userId).in('client_id',group),`Verificación de ${table}`));
  }
  const observed=new Set(found.map(x=>x.client_id));
  if (new Set(ids).size!==observed.size || ids.some(id=>!observed.has(id))) throw new Error(`Verificación incompleta de ${table}. No se marcará importación exitosa.`);
  return found;
}
export const remoteClientIds=plan=>({
  routines:plan.subset.routines.map(r=>clientId('routine',r.id)),
  records:plan.subset.records.map(r=>clientId('record',r.id)),
  habits:plan.subset.habits.map(h=>clientId('habit',h.id)),
});

/** Migración explícita, solo hacia nube, sin modificar storage local. Idempotencia: DO NOTHING por client_id. */
export async function performCloudImport(client, verifiedUserId, snapshot, selection) {
  const {subset,report}=prepareCloudImport(snapshot,selection);
  if (!verifiedUserId || !/^[0-9a-f-]{36}$/i.test(verifiedUserId)) throw new Error('Identidad de usuario inválida.');
  const user_id=verifiedUserId;
  const profile={user_id,theme:['dark','light','system'].includes(snapshot.theme)?snapshot.theme:'dark',focus:['gym','others','both'].includes(snapshot.focus)?snapshot.focus:'both',onboarding_done:Boolean(snapshot.onboardSeen)};
  // Crear solo si falta; jamás sobrescribir preferencias remotas al reintentar.
  await insertIgnore(client,'perci_profiles',[profile],'user_id');
  const names=remoteClientIds({subset});
  await insertIgnore(client,'perci_routines',subset.routines.map(r=>({user_id,client_id:clientId('routine',r.id),name:r.name})), 'user_id,client_id');
  const remoteRoutines=await retrieve(client,'perci_routines',user_id,names.routines);
  const routineMap=new Map(remoteRoutines.map(x=>[x.client_id,x.id]));
  const exercises=subset.routines.flatMap(r=>r.exercises.map((e,i)=>({user_id,routine_id:routineMap.get(clientId('routine',r.id)),client_id:clientId('exercise',`${r.id}:${i}`),position:i,name:e.name,target_sets:Number(e.sets),target_reps:Number(e.reps)})));
  await insertIgnore(client,'perci_routine_exercises',exercises,'user_id,client_id');
  await retrieve(client,'perci_routine_exercises',user_id,exercises.map(e=>e.client_id));
  await insertIgnore(client,'perci_activity_records',subset.records.map(r=>({user_id,client_id:clientId('record',r.id),activity_type:r.type,name:r.name,activity_date:r.date,minutes:Number(r.minutes),distance_km:r.distance===undefined?null:Number(r.distance),sets_done:r.setsDone===undefined?null:Number(r.setsDone),volume_kg:r.volume===undefined?null:Number(r.volume),note:String(r.note??'').slice(0,400)})),'user_id,client_id');
  await retrieve(client,'perci_activity_records',user_id,names.records);
  // Las series históricas de v0.4 no conservan el detalle por serie: no inventarlas.
  await insertIgnore(client,'perci_habits',subset.habits.map(h=>({user_id,client_id:clientId('habit',h.id),name:h.name,days:h.days,paused:Boolean(h.paused)})),'user_id,client_id');
  const remoteHabits=await retrieve(client,'perci_habits',user_id,names.habits);
  const habitMap=new Map(remoteHabits.map(h=>[h.client_id,h.id]));
  const checks=Object.entries(subset.checks||{}).filter(([,v])=>v===true).map(([key])=>{
    const idx=key.lastIndexOf(':');
    return {user_id,habit_id:habitMap.get(clientId('habit',key.slice(0,idx))),check_date:key.slice(idx+1),completed:true};
  });
  await insertIgnore(client,'perci_habit_checks',checks,'user_id,habit_id,check_date');
  if(checks.length){
    // Verificar checks por fechas y por dueño; no dar éxito si falta alguno.
    const result=await client.from('perci_habit_checks').select('habit_id,check_date').eq('user_id',user_id);
    const found=rows(result,'Verificación de cumplimientos');
    const observed=new Set(found.map(c=>`${c.habit_id}:${c.check_date}`));
    if(checks.some(c=>!observed.has(`${c.habit_id}:${c.check_date}`)))throw new Error('Algunos cumplimientos no se pudieron verificar.');
  }
  return {routines:subset.routines.length,exercises:exercises.length,records:subset.records.length,habits:subset.habits.length,checks:checks.length,notes:report.warnings};
}
