import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/src/app.js',import.meta.url),'utf8');
const htmlEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,value='',cls='')=>`<button class="btn ${cls}" data-action="${action}" data-value="${htmlEscape(value)}">${label}</button>`;
const slice=(start,end)=>{
  const i=source.indexOf(start),j=source.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,`No se encontró ${start} hasta ${end}`);
  return source.slice(i,j);
};
const fragment=slice('function renderRoutineEdit(){','const asKg=');
function renderEdit(editor,renamingExercise=null){
  const app={editor,renamingExercise,activeUid:'u'};
  return new Function('app','h','back','title','button','isOfflineNow','account',` ${fragment}; return renderRoutineEdit();`)(
    app,htmlEscape,()=>'<button>Volver</button>',(a,b)=>`<h1>${a}</h1><p>${b}</p>`,button,()=>false,{}
  );
}
test('editor: permite renombrar un ejercicio existente sin perder los controles previos',()=>{
  const editor={id:'r1',name:'Día 1',exercises:[{name:'Mi ejercicio anterior',sets:4,reps:8},{name:'Press banca',sets:3,reps:10}]};
  const closed=renderEdit(editor);
  assert.match(closed,/Mi ejercicio anterior/);
  assert.match(closed,/data-action="renameExercise"/);
  assert.equal((closed.match(/data-action="renameExercise"/g)||[]).length,2);
  assert.match(closed,/data-action="removeExercise"/);
  const open=renderEdit(editor,0);
  assert.match(open,/id="exercise-name-0"/);
  assert.match(open,/data-field="exerciseName"/);
  assert.match(open,/value="Mi ejercicio anterior"/);
  assert.match(open,/El historial de sesiones anteriores no cambia/);
  assert.match(open,/Listo/);
  assert.ok(!open.includes('id="exercise-name-1"'));
});
test('editor: el valor de nombre se escapa para evitar inyección HTML',()=>{
  const open=renderEdit({id:'r1',name:'A',exercises:[{name:'<img src=x onerror=alert(1)>',sets:3,reps:10}]},0);
  assert.ok(open.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!open.includes('<img src=x'));
});
test('borrador: persistEditor guarda el nombre modificado con series y reps',()=>{
  const persist=slice('function persistEditor(){','function beginSession(');
  let stored=null;
  const app={activeUid:'u',editor:{id:'r1',name:'Día 1',exercises:[{name:'Original',sets:4,reps:10}]}};
  const row={dataset:{exrow:'0'},querySelector:sel=>({
    '[data-field=exerciseName]':{value:'  Remo personalizado  '},
    '[data-field=sets]':{value:'5'},
    '[data-field=reps]':{value:'12'}
  }[sel]||null)};
  const get=id=>id==='rname'?{value:'Día 1 nueva'}:null;
  const document={querySelectorAll:()=>[row]};
  const saveRoutineEditor=(uid,data)=>{stored=structuredClone(data);};
  new Function('app','get','document','saveRoutineEditor','toast',`${persist};return persistEditor;`)(app,get,document,saveRoutineEditor,()=>{})();
  assert.equal(stored.name,'Día 1 nueva');
  assert.equal(stored.exercises[0].name,'  Remo personalizado  ');
  assert.equal(stored.exercises[0].sets,5);
  assert.equal(stored.exercises[0].reps,12);
});

test('renombrar: confirma, conserva el índice y bloquea nombres vacíos',()=>{
  const handler=slice('function handle(action,value){switch(action){','document.addEventListener(\'click\'');
  const app={activeUid:'u',editor:{id:'r1',name:'Día 1',exercises:[{name:'Original',sets:3,reps:10}]},renamingExercise:null};
  let saved=null,renderCount=0,notice='';
  const perform=new Function('app','persistEditor','saveRoutineEditor','render','toast',`${handler}; return handle;`)(app,()=>{},(uid,editor)=>{saved=structuredClone(editor)},()=>renderCount++,s=>notice=s);
  perform('renameExercise','0');
  assert.equal(app.renamingExercise,0);
  app.editor.exercises[0].name='  Nuevo ejercicio  ';
  perform('renameExercise','0');
  assert.equal(app.renamingExercise,null);
  assert.equal(app.editor.exercises[0].name,'Nuevo ejercicio');
  assert.equal(saved.exercises[0].name,'Nuevo ejercicio');
  assert.equal(renderCount,2);
  perform('renameExercise','0');
  app.editor.exercises[0].name='  ';
  perform('renameExercise','0');
  assert.equal(app.renamingExercise,0);
  assert.match(notice,/no puede estar vacío/);
});
test('guardado: valida nombre obligatorio, longitud y recorta espacios',()=>{
  const handler=slice('function handle(action,value){switch(action){','document.addEventListener(\'click\'');
  assert.match(handler,/case 'renameExercise':/);
  assert.match(handler,/name\.length>80/);
  assert.match(handler,/!x\.name\.trim\(\)/);
  assert.match(handler,/exercises:e\.exercises\.map\(x=>\(\{\.\.\.x,name:x\.name\.trim\(\)\}\)\)/);
  // La acción nueva no toca registros históricos ni sesiones en curso.
  const rename=handler.slice(handler.indexOf("case 'renameExercise':"),handler.indexOf("case 'removeExercise':"));
  assert.doesNotMatch(rename,/state\.(records|draft|routines)\s*=/);
  assert.doesNotMatch(rename,/lib\.splice/);
});
