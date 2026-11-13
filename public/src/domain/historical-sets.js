/** Percí v1.10.0: edición de series ya confirmadas, sin mutar la sesión original. */
const error = message => { throw new Error(message); };
const parseWeight = raw => {
  const value=String(raw??'').trim().replace(',', '.');
  if(!/^\d+(?:\.\d{1,2})?$/.test(value))error('Ingresá un peso válido (máximo dos decimales).');
  const n=Number(value);
  if(!Number.isFinite(n)||n<0||n>99999)error('El peso debe estar entre 0 y 99999 kg.');
  return n;
};
const parseReps = raw => {
  const value=String(raw??'').trim();
  if(!/^\d+$/.test(value))error('Ingresá un número entero de repeticiones.');
  const n=Number(value);
  if(!Number.isInteger(n)||n<0||n>100)error('Las repeticiones deben estar entre 0 y 100.');
  return n;
};

export function updateHistoricalSets(record, edits){
  if(!record||record.type!=='gym'||!Array.isArray(record.setDetails)||!record.setDetails.length)
    error('Este entrenamiento no tiene series editables.');
  if(!Array.isArray(edits))error('No recibimos los valores de las series.');
  const indices=record.setDetails.map((set,i)=>set.completed===false?-1:i).filter(i=>i>=0);
  if(!indices.length||edits.length!==indices.length)
    error('Faltan series para guardar. Revisá el entrenamiento.');
  const replacements=new Map();
  for(const edit of edits){
    const index=edit?.index;
    if(!Number.isInteger(index)||!indices.includes(index)||replacements.has(index))
      error('Una serie es inválida o está repetida.');
    replacements.set(index,{weight:parseWeight(edit.weight),reps:parseReps(edit.reps)});
  }
  if(replacements.size!==indices.length)error('Faltan series para guardar.');
  const setDetails=record.setDetails.map((set,i)=>replacements.has(i)?{...set,...replacements.get(i)}:{...set});
  const completed=setDetails.filter(set=>set.completed!==false);
  const volume=Math.round(completed.reduce((sum,set)=>sum+Number(set.weight)*Number(set.reps),0)*100)/100;
  if(!Number.isFinite(volume))error('El volumen calculado no es válido.');
  return {...record,setDetails,setsDone:completed.length,volume};
}
