/** Remove v0.4 illustrative data only when the exported backup explicitly declares demo=true.
 * Keeps all user-created routines, even when their old export still carried demo=true.
 */
export function cleanImportedState(snapshot){
  if(!snapshot || snapshot.demo !== true)return snapshot;
  const isFixture=(id,ids)=>ids.includes(id);
  const excludedHabits=new Set(['h1','h2']);
  return {
    ...snapshot,
    demo:false,
    routines:(snapshot.routines||[]).filter(x=>!isFixture(x.id,['r1'])),
    records:(snapshot.records||[]).filter(x=>!isFixture(x.id,['s1','s2','s3'])),
    habits:(snapshot.habits||[]).filter(x=>!excludedHabits.has(x.id)),
    checks:Object.fromEntries(Object.entries(snapshot.checks||{}).filter(([key])=>
      !excludedHabits.has(key.split(':')[0])))
  };
}
