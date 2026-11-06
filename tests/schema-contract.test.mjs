import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/202611050001_perci_core.sql',import.meta.url),'utf8');
const tables=['profiles','routines','routine_exercises','activity_records','workout_sets','habits','habit_checks','workout_drafts'];
test('declara 8 tablas, RLS en todas y revoca acceso no autenticado',()=>{
  for(const short of tables){
    const table='perci_'+short;
    assert.ok(sql.includes(`create table public.${table} (`),`${table}: tabla faltante`);
    assert.ok(sql.includes(`alter table public.${table} enable row level security;`),`${table}: RLS faltante`);
    assert.ok(sql.includes(`'${table}'`),`${table}: no entra al bucle de políticas`);
  }
  assert.match(sql,/from public, anon, authenticated;/);
  assert.match(sql,/grant select, insert, update, delete on table/);
  assert.match(sql,/for select to authenticated using/);
  assert.match(sql,/for insert to authenticated with check/);
  assert.match(sql,/for update to authenticated using/);
  assert.match(sql,/for delete to authenticated using/);
});
test('tablas hijas tienen clave foránea de propietario compuesto',()=>{
  for(const target of ['perci_routines','perci_activity_records','perci_habits']){
    assert.ok(sql.includes(`references public.${target} (user_id, id)`));
  }
});
