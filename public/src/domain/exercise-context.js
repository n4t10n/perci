/** Percí QA v1.19.2 · contexto privado del ejercicio. */
const labels=Object.freeze({barra:'Barra',mancuernas:'Mancuernas',maquina:'Máquina',discos:'Discos',polea:'Polea',multipower:'Multipower',bilateral:'Bilateral',unilateral:'Unilateral','barra-ez':'Barra EZ','peso-corporal':'Peso corporal','agarre-abierto':'Agarre abierto','agarre-cerrado':'Agarre cerrado','agarre-neutro':'Agarre neutro','agarre-supino':'Agarre supino','prensa-45':'45°','prensa-horizontal':'Horizontal','prensa-vertical':'Vertical',cuerda:'Cuerda','barra-recta':'Barra recta','barra-v':'Barra V'});
const normalize=name=>String(name??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();
const groups=[
  [['press de banca','press banca','press plano'],['barra','mancuernas','maquina','multipower']],
  [['hip thrust','hip trust'],['barra','discos','maquina']],
  [['press militar','press militar con mancuernas'],['barra','mancuernas','maquina']],
  [['curl de biceps','curl biceps'],['mancuernas','barra','barra-recta','barra-ez','polea','maquina']],
  [['remo'],['barra','mancuernas','polea','maquina']],
  [['remo inclinado'],['barra','mancuernas','multipower']],
  [['sentadilla','sentadillas'],['barra','mancuernas','multipower','peso-corporal']],
  [['elevacion lateral','elevaciones laterales'],['mancuernas','polea','maquina']],
  [['peso muerto'],['barra','mancuernas']],
  [['peso muerto rumano'],['barra','mancuernas']],
  [['sillon de cuadriceps','sillon cuadriceps','extension de cuadriceps','extension de piernas'],['bilateral','unilateral']],
  [['femorales sentado','femoral sentado','curl femoral sentado'],['bilateral','unilateral']],
  [['femorales en camilla','femoral en camilla','curl femoral acostado'],['bilateral','unilateral']],
  [['press inclinado','press inclinado con mancuernas','press de banca inclinado'],['mancuernas','barra','maquina','multipower']],
  [['jalon al pecho'],['agarre-abierto','agarre-cerrado','agarre-neutro','agarre-supino']],
  [['prensa maquina','prensa de piernas','prensa'],['prensa-45','prensa-horizontal','prensa-vertical']],
  [['remo sentado','remo en polea baja'],['agarre-cerrado','agarre-abierto','agarre-neutro']],
  [['apertura en maquina','aperturas en maquina','aperturas de pecho','aperturas con mancuernas'],['maquina','polea','mancuernas']],
  [['triceps en polea','extension de triceps en polea'],['cuerda','barra-recta','barra-v','unilateral']],
  [['aductores en maquina'],['bilateral','unilateral']],
  [['curl de biceps + press militar','curl biceps + press militar'],[]]
];
const groupFor=name=>groups.find(([names])=>names.includes(normalize(name)));
export const variantExerciseKey=name=>groupFor(name)?.[0][0]||normalize(name);
const customPattern=/^custom:[a-z0-9][a-z0-9 -]{0,39}$/;
export const isCustomVariant=id=>typeof id==='string'&&customPattern.test(id);
export function customVariantId(label){
  const slug=normalize(label);if(!/^[a-z0-9][a-z0-9 -]{0,39}$/.test(slug)||Object.values(labels).some(v=>normalize(v)===slug))return '';
  return 'custom:'+slug;
}
export const variantLabel=id=>Object.hasOwn(labels,id)?labels[id]:isCustomVariant(id)?id.slice(7,8).toUpperCase()+id.slice(8):'';
export function cleanVariantRegistry(value){
  const map=new Map();
  for(const e of Array.isArray(value)?value:[]){
    if(!e||typeof e.exercise!=='string'||!e.exercise.trim()||e.exercise.length>80||!isCustomVariant(e.variant)||typeof e.active!=='boolean')continue;
    const row={exercise:variantExerciseKey(e.exercise),variant:e.variant,active:e.active};map.set(JSON.stringify([row.exercise,row.variant]),row);
  }
  return [...map.values()].sort((a,b)=>a.exercise.localeCompare(b.exercise,'es-AR')||a.variant.localeCompare(b.variant,'es-AR'));
}
export function mergeVariantRegistry(base,local,remote){
  const toMap=items=>new Map(cleanVariantRegistry(items).map(x=>[JSON.stringify([x.exercise,x.variant]),x]));
  const old=toMap(base),a=toMap(local),b=toMap(remote),out=[];
  for(const key of new Set([...old.keys(),...a.keys(),...b.keys()])){
    const o=old.get(key),l=a.get(key),r=b.get(key);
    // Absence is not a delete; archive is explicit. With no baseline archive wins.
    if(!l||!r)out.push(l||r||o);
    else if(l.active===r.active)out.push(l);
    else if(o)out.push(l.active===o.active?r:l);
    else out.push(l.active?r:l);
  }
  return cleanVariantRegistry(out);
}
export function setCustomVariant(registry,name,id,active){
  if(!isCustomVariant(id)||typeof active!=='boolean')throw Error('Variante inválida.');
  const exercise=variantExerciseKey(name);if(!exercise||exercise.length>80)throw Error('Ejercicio inválido.');
  const list=cleanVariantRegistry(registry).filter(x=>x.exercise!==exercise||x.variant!==id);
  list.push({exercise,variant:id,active});if(list.length>300)throw Error('Máximo 300 variantes personalizadas por cuenta.');
  return cleanVariantRegistry(list);
}
export function exerciseVariants(name,registry=[]){
  return [...new Set([...(groupFor(name)?.[1]||[]),...cleanVariantRegistry(registry).filter(x=>x.exercise===variantExerciseKey(name)&&x.active).map(x=>x.variant)])];
}
// La preferencia es por ejercicio de rutina; el catálogo queda intacto.
const defaultDisabled=new Set(['sillon de cuadriceps','remo inclinado','curl de biceps + press militar','prensa maquina','remo sentado','apertura en maquina']);
export function variantsEnabled(item,registry=[]){
  if(typeof item?.variantsEnabled==='boolean')return item.variantsEnabled;
  return !defaultDisabled.has(variantExerciseKey(item?.name)) && Boolean(item?.defaultVariant||exerciseVariants(item?.name,registry).length);
}
export const validVariant=(name,id)=>exerciseVariants(name).includes(id)||isCustomVariant(id)?id:'';
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
export function sessionExerciseSnapshot(exercises,records,registry=[]){
  return exercises.map(item=>{const {variant:_,defaultVariant,...rest}=item;const enabled=variantsEnabled(item,registry);const last=lastExerciseVariant(records,item.name);const chosen=enabled?(validVariant(item.name,defaultVariant)||(exerciseVariants(item.name,registry).includes(last)?last:'')):'';return {...rest,variantsEnabled:enabled,...(chosen?{variant:chosen}:{})};});
}
export const trackedExerciseName=set=>`${String(set.exerciseName||'').trim()}${variantLabel(set.variant)?' · '+variantLabel(set.variant):''}`;
export function exerciseNotesForDraft(draft){
  return (draft.snapshot||[]).flatMap((item,i)=>{const note=cleanNote(draft.exerciseNotes?.[i]).trim(),variant=validVariant(item.name,item.variant);return note?[{exercisePosition:i,exerciseName:item.name,note,...(variant?{variant}:{})}]:[];});
}
export function canChangeVariant(draft,index){
  return !Object.entries(draft.sets||{}).some(([key,s])=>key.startsWith(`${index}-`)&&s.done===true);
}
