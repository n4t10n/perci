/** Percí v1.6: métricas derivadas únicamente de series de fuerza completadas.
 * No modifica registros ni depende de almacenamiento, red o DOM.
 */
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
export const exerciseKey = name => String(name||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es-AR');
const validSets = record => record?.type === 'gym' && Array.isArray(record.setDetails)
  ? record.setDetails.filter(x => x && x.completed === true &&
      typeof x.exerciseName === 'string' && isFiniteNumber(Number(x.weight)) &&
      isFiniteNumber(Number(x.reps)) && Number(x.weight) >= 0 && Number(x.reps) >= 0)
  : [];
/** Serie comparable por posición del ejercicio y número, sólo dentro de la cuenta actual. */
export function previousExerciseSet(records, exerciseName, setNumber) {
  const key = exerciseKey(exerciseName);
  const ordered = (Array.isArray(records)?records:[]).map((record,index)=>({record,index}))
    .sort((a,b)=>String(b.record?.date||'').localeCompare(String(a.record?.date||''))||a.index-b.index);
  for(const {record} of ordered){
    const prior=validSets(record).find(s=>exerciseKey(s.exerciseName)===key && Number(s.setNumber)===setNumber);
    if(prior)return {weight:Number(prior.weight),reps:Number(prior.reps),date:record.date};
  }
  return null;
}
export function listTrackedExercises(records){
  const found=new Map();
  for(const record of Array.isArray(records)?records:[]){
    for(const set of validSets(record)){
      const key=exerciseKey(set.exerciseName);
      if(key && !found.has(key))found.set(key,set.exerciseName.trim());
    }
  }
  return [...found.values()].sort((a,b)=>a.localeCompare(b,'es-AR'));
}
/** Una observación = un entrenamiento; nunca inferir récords ni estimaciones de 1RM. */
export function exerciseHistory(records,exerciseName){
  const key=exerciseKey(exerciseName);
  return (Array.isArray(records)?records:[]).map((record,index)=>{
    const sets=validSets(record).filter(s=>exerciseKey(s.exerciseName)===key);
    if(!sets.length)return null;
    const maximum=Math.max(...sets.map(s=>Number(s.weight)));
    const best=sets.find(s=>Number(s.weight)===maximum);
    return {id:String(record.id||index),date:String(record.date||''),maxWeight:maximum,
      repsAtMax:Number(best.reps),sets:sets.length,
      volume:Math.round(sets.reduce((sum,s)=>sum+Number(s.weight)*Number(s.reps),0)*100)/100,
      _index:index};
  }).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)||b._index-a._index)
    .map(({_index,...rest})=>rest);
}
export function sessionStats(draft, now=Date.now()){
  const completed=Object.values(draft?.sets||{}).filter(x=>x?.done===true);
  const total=(draft?.snapshot||[]).reduce((sum,x)=>sum+Math.max(0,Number(x.sets)||0),0);
  return {completed:completed.length,total,
    volume:Math.round(completed.reduce((sum,x)=>sum+Number(x.weight||0)*Number(x.reps||0),0)*100)/100,
    minutes:Math.max(1,Math.round((now-Number(draft?.startedAt||now))/60000))};
}
export function nextPendingSet(draft){
  for(let i=0;i<(draft?.snapshot||[]).length;i++){
    for(let j=0;j<Number(draft.snapshot[i].sets||0);j++){
      const key=`${i}-${j}`;
      if(draft.sets?.[key]?.done!==true)return key;
    }
  }
  return null;
}
export const restRemaining = (until,now=Date.now()) => Math.max(0,Math.ceil((Number(until||0)-now)/1000));
export function restClock(until,now=Date.now()){
  const seconds=restRemaining(until,now);
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
