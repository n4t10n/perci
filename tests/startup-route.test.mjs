import test from 'node:test';
import assert from 'node:assert/strict';
import { getInitialView } from '../public/src/domain/startup-route.js';

test('usuario nuevo recibe Bienvenida', () => {
  assert.equal(getInitialView(null), 'onboard');
  assert.equal(getInitialView({onboardSeen:false,demo:true,routines:[{id:'r1'}],records:[{id:'s1'}],habits:[{id:'h1'}],checks:{},draft:null}), 'onboard');
});

test('usuario que completó bienvenida empieza en Inicio', () => {
  assert.equal(getInitialView({onboardSeen:true,demo:true}), 'home');
});

test('datos de usuario en versión antigua nunca reabren Ajustes', () => {
  const state={onboardSeen:false,demo:true,routines:[{id:'fgyd1rw7',name:'Dia 1 Full Body',exercises:[{name:'Press de banca',sets:4,reps:10}]}],records:[{id:'s1'}],habits:[],checks:{},draft:null};
  assert.equal(getInitialView(state), 'home');
  assert.equal(state.routines[0].exercises[0].sets, 4);
});

test('draft, registro o hábito propios también entran a Inicio', () => {
  const base={onboardSeen:false,demo:true,routines:[{id:'r1'}],records:[{id:'s1'}],habits:[{id:'h1'}],checks:{},draft:null};
  assert.equal(getInitialView({...base,draft:{routineId:'r1'}}),'home');
  assert.equal(getInitialView({...base,records:[{id:'own'}]}),'home');
  assert.equal(getInitialView({...base,habits:[{id:'own'}]}),'home');
});

test('sin datos demo, se reconoce como usuario existente',()=>{
  assert.equal(getInitialView({onboardSeen:false,demo:false,routines:[],records:[],habits:[]}), 'home');
});
