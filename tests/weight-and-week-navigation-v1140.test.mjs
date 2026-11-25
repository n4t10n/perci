import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {updateHistoricalSets} from '../public/src/domain/historical-sets.js';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../public/src/app.js');
const css=read('../public/src/styles.css');
const sw=read('../public/sw.js');
const html=read('../public/index.html');

const helpers=app.slice(app.indexOf('const formatInputWeight='),app.indexOf('function renderRestPanel('));
const weight=vm.runInNewContext(helpers+';({parseSessionWeight,formatInputWeight})');
test('Sesión: 7.5 y 7,5 se guardan como el mismo número y se muestran con coma',()=>{
  assert.equal(weight.parseSessionWeight('7.5'),7.5);
  assert.equal(weight.parseSessionWeight('7,5'),7.5);
  assert.equal(weight.parseSessionWeight('0,25'),0.25);
  assert.equal(weight.parseSessionWeight('10.'),10);
  assert.equal(weight.parseSessionWeight(''),0);
  assert.equal(weight.formatInputWeight(7.5),'7,5');
  for(const invalid of ['-1','99999,9','7,123','1.2.3','abc','1,2,3'])assert.equal(weight.parseSessionWeight(invalid),null);
});
test('Sesión e historial: inputs de texto decimal, y normalización visual en vivo',()=>{
  assert.match(app,/input type="text" inputmode="decimal"[^>]*data-field="weight"/);
  assert.match(app,/input id="history-weight-\$\{i\}" type="text" inputmode="decimal"/);
  assert.match(app,/const weight=parseSessionWeight\(row\.querySelector/);
  assert.match(app,/parsed=parseSessionWeight\(row\.querySelector/);
  assert.match(app,/e\.target\.value=e\.target\.value\.replace\(\/\\\.\/g,','\)/);
  const record={id:'test',type:'gym',setDetails:[{weight:7.5,reps:10,completed:true}]};
  assert.equal(updateHistoricalSets(record,[{index:0,weight:'7.5',reps:'10'}]).volume,75);
  assert.equal(updateHistoricalSets(record,[{index:0,weight:'7,5',reps:'10'}]).volume,75);
});

const calendar=app.slice(app.indexOf('function renderActivityCalendar(){'),app.indexOf('function renderProgress(){'));
const today='2026-11-24';
const offsetDate=n=>new Date(Date.UTC(2026,10,24+n)).toISOString().slice(0,10);
function showWeek(offset,selected=null,records=[]){
  const context={app:{progressWeekOffset:offset,progressDay:selected},state:{records},dateISO:()=>today,offsetDate,
    weekDay:date=>date.slice(-2),categories:[['gym','Gimnasio','🏋️']],icon:()=>'',h:v=>String(v)};
  return vm.runInNewContext('('+calendar+')',context)();
}
test('Calendario: semana lunes-domingo, 7 días por página y no permite ir al futuro',()=>{
  const current=showWeek(0);
  assert.match(current,/data-value="2026-11-23"/);
  assert.match(current,/data-value="2026-11-29"/);
  assert.equal((current.match(/data-action="progressDay"/g)||[]).length,7);
  assert.match(current,/data-action="progressWeek" data-value="1"[^>]*disabled/);
  const previous=showWeek(-1);
  assert.match(previous,/data-value="2026-11-16"/);
  assert.match(previous,/data-value="2026-11-22"/);
  assert.doesNotMatch(previous,/data-value="2026-11-23"/);
});
test('Calendario: tocar un día lista todas las actividades y enlaza al registro existente',()=>{
  const records=[{id:'r1',date:'2026-11-23',type:'gym',name:'Piernas',minutes:55},
    {id:'r2',date:'2026-11-23',type:'run',name:'Running',minutes:30},
    {id:'r3',date:'2026-11-24',type:'gym',name:'Pecho',minutes:60}];
  const html=showWeek(0,'2026-11-23',records);
  assert.match(html,/Piernas/);assert.match(html,/Running/);
  assert.doesNotMatch(html,/Pecho/);
  assert.match(html,/data-action="detailRecord" data-value="r1"/);
  assert.match(html,/data-action="detailRecord" data-value="r2"/);
  assert.match(showWeek(-1,'2026-11-22',records),/No hay actividades registradas ese día/);
});
test('Calendario: gesto a la derecha abre semana anterior y mantiene scroll vertical',()=>{
  assert.match(app,/dx>0\?'-1':'1'/);
  assert.match(app,/Math\.abs\(dx\)<55/);
  assert.match(css,/\.activity-week\{touch-action:pan-y/);
  assert.match(app,/case 'progressDay':/);
  assert.match(app,/case 'progressWeek':/);
  assert.match(app,/\$\{renderActivityCalendar\(\)\}<\/div><\/div>\$\{renderStrengthEvolution\(\)\}/);
});
test('PWA: HTML y Service Worker exponen la misma versión nueva',()=>{
  for(const source of [html,sw]){
    assert.match(source,/src\/app\.js\?v=1\.19\.1/);
    assert.match(source,/src\/styles\.css\?v=1\.19\.1/);
  }
  assert.match(sw,/perci-shell-v1\.19\.1-exercise-context/);
});
