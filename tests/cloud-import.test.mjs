import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCloudImport,performCloudImport,remoteClientIds} from '../public/src/cloud/migration.js';
import {validatePublicConfig} from '../public/src/cloud/config.js';

const owner='10000000-0000-4000-a000-000000000001';
const local=()=>({version:2,demo:true,focus:'both',theme:'dark',onboardSeen:false,draft:null,routines:[{id:'fgyd1rw7',name:'Dia 1 Full Body',exercises:[{name:'Press de banca',sets:4,reps:10},{name:'Sillón de Cuadriceps',sets:4,reps:10}]}],records:[{id:'s1',type:'gym',name:'Torso · Fuerza',minutes:52,date:'2026-11-04',setsDone:9,volume:1850,note:''}],habits:[{id:'h1',name:'Hidratarme',days:[0,1,2,3,4,5,6],paused:false}],checks:{'h1:2026-11-04':true}});

function memorySupabase(){
  const store=new Map();
  const entry=t=>{if(!store.has(t))store.set(t,[]);return store.get(t)};
  class Query{
    constructor(t){this.t=t;this.filters=[];}
    eq(k,v){this.filters.push(x=>x[k]===v);return this;}
    in(k,v){this.filters.push(x=>v.includes(x[k]));return this;}
    select(){return this;}
    then(resolve,reject){return Promise.resolve({data:entry(this.t).filter(r=>this.filters.every(fn=>fn(r))),error:null}).then(resolve,reject);}
    async upsert(data,opts){const table=entry(this.t);for(const x of data){const columns=opts.onConflict.split(',');const found=table.find(z=>columns.every(k=>z[k]===x[k]));if(!found)table.push({...x,id:x.id??`mock-${table.length+1}`});else if(!opts.ignoreDuplicates)Object.assign(found,x);}return {error:null};}
  }
  return {from:t=>new Query(t),store};
}

test('crea una vista previa selectiva sin incluir datos de ejemplo por accidente',()=>{
 const plan=prepareCloudImport(local(),{routines:true,records:false,habits:false});
 assert.equal(plan.subset.routines.length,1);
 assert.equal(plan.subset.records.length,0);
 assert.equal(plan.subset.habits.length,0);
 assert.equal(plan.report.counts.exercises,2);
 assert.deepEqual(remoteClientIds(plan).routines,['perci-v04:routine:fgyd1rw7']);
});

test('no permite importar si la sesión de gimnasio sigue activa',()=>{
 const state=local();state.draft={routineId:'fgyd1rw7',sets:{}};
 assert.throws(()=>prepareCloudImport(state,{routines:true}),/entrenamiento en curso/);
});

test('hace importación idempotente, verifica lectura y no modifica snapshot original',async()=>{
 const s=local(),original=JSON.stringify(s),db=memorySupabase();
 const first=await performCloudImport(db,owner,s,{routines:true,records:false,habits:false});
 assert.equal(first.routines,1);assert.equal(first.exercises,2);
 assert.equal(db.store.get('perci_routines').length,1);
 assert.equal(db.store.get('perci_routine_exercises').length,2);
 assert.equal(db.store.get('perci_activity_records'),undefined);
 await performCloudImport(db,owner,s,{routines:true,records:false,habits:false});
 assert.equal(db.store.get('perci_routines').length,1);
 assert.equal(db.store.get('perci_routine_exercises').length,2);
 assert.equal(JSON.stringify(s),original);
});

test('permite elegir explícitamente demo y verifica hábitos completados',async()=>{
 const db=memorySupabase();const result=await performCloudImport(db,owner,local(),{routines:false,records:true,habits:true});
 assert.equal(result.records,1);assert.equal(result.habits,1);assert.equal(result.checks,1);
 assert.equal(db.store.get('perci_habit_checks').length,1);
});

test('rechaza URL arbitraría y claves secretas en navegador',()=>{
 assert.throws(()=>validatePublicConfig('https://example.com','sb_publishable_12345678901234567890'),/supabase.co/);
 assert.throws(()=>validatePublicConfig('https://abcdefghi.supabase.co','sb_secret_fake123456789000000000'),/clave secreta/);
 assert.deepEqual(validatePublicConfig('https://abc123.supabase.co/','sb_publishable_12345678901234567890'),{url:'https://abc123.supabase.co',key:'sb_publishable_12345678901234567890'});
});
