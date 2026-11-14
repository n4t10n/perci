import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../public/src/app.js');
const css=read('../public/src/styles.css');
const start=app.indexOf('function renderOtherForm(){');
const end=app.indexOf('function renderStrengthEvolution(){',start);
assert.ok(start>=0&&end>start,'Debe encontrarse el formulario compartido');
const formSource=app.slice(start,end).trim();

function renderActivity(type){
  const context={
    app:{activity:type},account:{},
    categories:[['walk','Caminata','walk'],['run','Running','run'],['cycle','Bicicleta','cycle'],['sport','Deporte','sport'],['other','Otra','other']],
    back:()=>'',title:()=>'',button:()=>'',dateISO:()=> '2026-11-14',
    formatSessionDate:()=> '14 nov 2026',isOfflineNow:()=>false
  };
  return vm.runInNewContext('('+formSource+')',context)();
}

test('Caminata, Running, Bicicleta, Deporte y Otra usan la fecha adaptada para iPhone',()=>{
  for(const type of ['walk','run','cycle','sport','other']){
    const html=renderActivity(type);
    assert.match(html,/class="field record-date-field"/,type);
    assert.match(html,/class="record-date-control"/,type);
    assert.match(html,/id="adateText" aria-hidden="true">14 nov 2026/,type);
    assert.match(html,/type="date" id="adate" value="2026-11-14" aria-label="Fecha de la actividad"/,type);
    assert.match(html,/id="amins"/,type);
  }
});

test('El control recorta el ancho nativo de Safari pero sigue siendo interactivo',()=>{
  assert.match(css,/\.record-date-control\{[^}]*overflow:hidden/);
  assert.match(css,/\.record-date-control\{[^}]*width:100%;max-width:100%;min-width:0/);
  assert.match(css,/\.record-date-control input\[type=date\]\{[^}]*opacity:0;cursor:pointer/);
  assert.match(css,/\.record-date-control:focus-within\{outline:/);
});

test('Elegir otra fecha refresca la etiqueta sin perder el valor nativo',()=>{
  const marker="document.addEventListener('change',e=>{";
  const index=app.indexOf(marker);
  const end=app.indexOf("  if(e.target.id==='rdate'",index);
  assert.ok(index>=0&&end>index);
  const body=app.slice(index+marker.length,end);
  const text={textContent:'14 nov 2026'};
  const context={
    app:{view:'otherForm'},
    document:{getElementById:id=>id==='adateText'?text:null},
    validDate:date=>/^\d{4}-\d{2}-\d{2}$/.test(date),
    formatSessionDate:date=>'fecha: '+date
  };
  const handler=vm.runInNewContext('(e=>{'+body+'})',context);
  handler({target:{id:'adate',value:'2026-11-12'}});
  assert.equal(text.textContent,'fecha: 2026-11-12');
  handler({target:{id:'adate',value:''}});
  assert.equal(text.textContent,'fecha: 2026-11-12');
});
