import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const start=src.indexOf('function handle(action,value){switch(action){');
const end=src.indexOf("document.addEventListener('click'",start);
assert.ok(start>=0&&end>start,'No se encuentra el manejador de acciones');
const handler=src.slice(start,end);
function runCase(action,{persist=true}={}){
  const old={id:'old',type:'walk',date:'2026-11-10',minutes:20,note:'antes'};
  const state={records:[old],theme:'dark',focus:'gym'};
  const app={record:'old',activity:'sport'};
  const navigations=[],messages=[];
  const fields={amins:'30',adate:'2026-11-12',aname:'Fútbol',anote:'test',rmin:'50',rdate:'2026-11-11',rnote:'cambiado'};
  const get=id=>id in fields?{value:fields[id]}:null;
  let renderCount=0;
  const go=v=>navigations.push(v),toast=x=>messages.push(x),render=()=>{renderCount++};
  const act=new Function('state','app','get','categories','validDate','id','save','go','toast','render',
    `${handler};return handle;`)(state,app,get,[['sport','Deporte','🏐']],()=>true,()=> 'nuevo1',()=>persist,go,toast,render);
  act(action,action==='theme'?'light':action==='focus'?'both':'');
  return {state,app,navigations,messages,renderCount,old};
}
test('Fallo de guardado: actividad no crea registro ni anuncia éxito',()=>{
  const r=runCase('saveActivity',{persist:false});
  assert.equal(r.state.records.length,1);
  assert.equal(r.navigations.length,0);
  assert.equal(r.messages.length,0);
});
test('Guardado correcto: actividad aparece una sola vez',()=>{
  const r=runCase('saveActivity');
  assert.equal(r.state.records.length,2);
  assert.equal(r.state.records[0].name,'Fútbol');
  assert.deepEqual(r.navigations,['progress']);
});
test('Fallo de guardado: un registro existente restaura valores',()=>{
  const r=runCase('saveRecord',{persist:false});
  assert.equal(r.old.minutes,20);
  assert.equal(r.old.date,'2026-11-10');
  assert.equal(r.old.note,'antes');
  assert.deepEqual(r.navigations,[]);
  assert.deepEqual(r.messages,[]);
});
test('Guardado correcto: el registro conserva la modificación',()=>{
  const r=runCase('saveRecord');
  assert.equal(r.old.minutes,50);
  assert.deepEqual(r.navigations,['progress']);
});
test('Fallo de guardado: tema y enfoque vuelven al original',()=>{
  const theme=runCase('theme',{persist:false});
  const focus=runCase('focus',{persist:false});
  assert.equal(theme.state.theme,'dark');
  assert.equal(focus.state.focus,'gym');
});
