/** Percí QA v1.18.0 · contexto privado del ejercicio. */
const labels=Object.freeze({barra:'Barra',mancuernas:'Mancuernas',maquina:'Máquina',discos:'Discos',polea:'Polea',multipower:'Multipower'});
const normalize=name=>String(name??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();
const groups=[
  [['press de banca','press banca'],['barra','mancuernas','maquina']],
  [['hip thrust','hip trust'],['barra','discos','maquina']],
  [['press militar'],['barra','mancuernas','maquina']],
  [['curl de biceps','curl biceps'],['barra','mancuernas','polea']],
  [['remo'],['barra','mancuernas','polea','maquina']],
  [['sentadilla','sentadillas'],['barra','mancuernas','multipower']],
  [['elevacion lateral','elevaciones laterales'],['mancuernas','polea','maquina']],
  [['peso muerto','peso muerto rumano'],['barra','mancuernas']]
];
export const exerciseVariants=name=>groups.find(([names])=>names.includes(normalize(name)))?.[1]||[];
export const variantLabel=id=>Object.hasOwn(labels,id)?labels[id]:'';
export const validVariant=(name,id)=>exerciseVariants(name).includes(id)?id:'';
export const cleanNote=value=>String(value??'').slice(0,250);
const ordered=records=>(Array.isArray(records)?records:[]).map((r,i)=>({r,i})).sort((a,b)=>String(b.r.date||'').localeCompare(String(a.r.date||''))||a.i-b.i).map(x=>x.r);
export function lastExerciseVariant(records,name){
  for(const r of ordered(records))if(r.type==='gym')for(const s of r.setDetails||[]){
    if(s.completed===true&&normalize(s.exerciseName)===normalize(name)&&validVariant(name,s.variant))return s.variant;
  }
  return '';
}
export function lastExerciseNote(records,name,variant=''){
  for(const r of ordered(records))if(r.type==='gym')for(const n of r.exerciseNotes||[]){
    if(normalize(n.exerciseName)===normalize(name)&&(n.variant||'')===variant&&n.note)return cleanNote(n.note);
  }
  return '';
}
export function sessionExerciseSnapshot(exercises,records){
  return exercises.map(item=>{const {variant:_,defaultVariant,...rest}=item;const chosen=validVariant(item.name,defaultVariant)||lastExerciseVariant(records,item.name);return {...rest,...(chosen?{variant:chosen}:{})};});
}
export const trackedExerciseName=set=>`${String(set.exerciseName||'').trim()}${variantLabel(set.variant)?' · '+variantLabel(set.variant):''}`;
export function exerciseNotesForDraft(draft){
  return (draft.snapshot||[]).flatMap((item,i)=>{const note=cleanNote(draft.exerciseNotes?.[i]).trim(),variant=validVariant(item.name,item.variant);return note?[{exercisePosition:i,exerciseName:item.name,note,...(variant?{variant}:{})}]:[];});
}
export function canChangeVariant(draft,index){
  return !Object.entries(draft.sets||{}).some(([key,s])=>key.startsWith(`${index}-`)&&s.done===true);
}
