import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {updateHistoricalSets} from '../public/src/domain/historical-sets.js';

const base=()=>({id:'registro1',type:'gym',name:'Pecho',date:'2026-11-12',minutes:60,
  setsDone:2,volume:760,note:'original',setDetails:[
  {exercisePosition:0,exerciseName:'Press de banca',setNumber:1,weight:40,reps:10,completed:true},
  {exercisePosition:0,exerciseName:'Press de banca',setNumber:2,weight:30,reps:12,completed:true}
]});
const changes=(weight='45',reps='8')=>[{index:0,weight,reps},{index:1,weight:'30',reps:'12'}];
test('Historial: recalcula volumen y conserva metadatos sin mutar el registro',()=>{
  const original=base(),before=structuredClone(original);
  const next=updateHistoricalSets(original,changes());
  assert.equal(next.volume,720);
  assert.equal(next.setsDone,2);
  assert.equal(next.setDetails[0].weight,45);
  assert.equal(next.setDetails[0].reps,8);
  assert.equal(next.setDetails[1].weight,30);
  assert.equal(next.date,original.date);
  assert.equal(next.minutes,original.minutes);
  assert.equal(next.note,original.note);
  assert.equal(next.id,original.id);
  assert.deepEqual(original,before);
  assert.notEqual(next.setDetails,original.setDetails);
});
test('Historial: acepta cero, coma decimal y hasta dos decimales',()=>{
  const x=updateHistoricalSets(base(),changes('0,25','0'));
  assert.equal(x.setDetails[0].weight,.25);
  assert.equal(x.setDetails[0].reps,0);
  assert.equal(x.volume,360);
});
test('Historial: no modifica series no confirmadas',()=>{
  const row=base();row.setDetails.push({exercisePosition:1,exerciseName:'Sentadilla',setNumber:1,weight:1,reps:5,completed:false});
  const updated=updateHistoricalSets(row,changes());
  assert.deepEqual(updated.setDetails[2],row.setDetails[2]);
  assert.equal(updated.setsDone,2);
});
test('Historial: rechaza valores y cantidades incorrectas antes de guardar',()=>{
  const cases=[changes('','8'),changes('-1','8'),changes('100000','8'),changes('12.345','8'),changes('20','2.5'),changes('20','101'),changes('a','10'),
    [changes()[0]],[changes()[0],changes()[0]],[{index:2,weight:'30',reps:'10'},changes()[1]]];
  for(const x of cases)assert.throws(()=>updateHistoricalSets(base(),x));
  assert.throws(()=>updateHistoricalSets({...base(),type:'walk'},changes()));
  assert.throws(()=>updateHistoricalSets({...base(),setDetails:[]},[]));
});
const app=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/src/styles.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const handler=app.slice(app.indexOf('function handle(action,value){switch(action){'),app.indexOf("document.addEventListener('click'"));
function exerciseSave(persist,weight='45',reps='8'){
  const record=base(),state={records:[record]},appState={record:'registro1'};
  const fields={'history-weight-0':weight,'history-reps-0':reps,'history-weight-1':'30','history-reps-1':'12'};
  const navigations=[],messages=[];let writes=0;
  const fn=new Function('state','app','get','updateHistoricalSets','save','go','toast',`${handler};return handle;`)(
    state,appState,id=>fields[id]===undefined?null:{value:fields[id]},updateHistoricalSets,
    ()=>{writes++;return persist;},v=>navigations.push(v),v=>messages.push(v)
  );
  fn('saveRecordSets','');
  return {record,state,navigations,messages,writes};
}
test('Guardado fallido: restaura exactamente la referencia anterior y no navega',()=>{
  const {record,state,navigations,messages,writes}=exerciseSave(false);
  assert.equal(state.records[0],record);
  assert.equal(record.volume,760);
  assert.equal(writes,1);
  assert.deepEqual(navigations,[]);
  assert.match(messages[0],/No pudimos guardar/);
});
test('Guardado correcto: una sola actualización y vuelve al detalle',()=>{
  const x=exerciseSave(true);
  assert.equal(x.state.records.length,1);
  assert.equal(x.state.records[0].volume,720);
  assert.notEqual(x.state.records[0],x.record);
  assert.deepEqual(x.navigations,['record']);
  assert.equal(x.writes,1);
});
test('Entrada inválida: no escribe, no navega, conserva la sesión',()=>{
  const x=exerciseSave(true,'-1','8');
  assert.equal(x.state.records[0],x.record);
  assert.deepEqual(x.navigations,[]);
  assert.equal(x.writes,0);
  assert.ok(x.messages.length);
});
test('UI: ruta propia, botones visibles, cancelación y campos accesibles',()=>{
  assert.match(app,/recordSetsEdit:'progress'/);
  assert.match(app,/recordSetsEdit:renderRecordSetsEdit/);
  assert.match(app,/case 'editRecordSets':/);
  assert.match(app,/case 'saveRecordSets':/);
  assert.match(app,/button\('Editar series','editRecordSets',r\.id/);
  assert.match(app,/history-weight-\$\{i\}/);
  assert.match(app,/history-reps-\$\{i\}/);
  assert.match(app,/Editar series/);
  assert.match(app,/button\('Cancelar','go','record','outline'\)/);
  assert.match(css,/\.historical-sets-row\{/);
  assert.match(css,/@media\(max-width:610px\)/);
});
test('PWA: módulo y CSS están en la misma caché de QA',()=>{
  assert.match(sw,/perci-shell-v1\.12\.0-exercise-gifs/);
  assert.match(sw,/domain\/historical-sets\.js\?v=1\.10\.0/);
  assert.match(sw,/src\/app\.js\?v=1\.12\.0/);
  assert.match(sw,/src\/styles\.css\?v=1\.12\.0/);
});
