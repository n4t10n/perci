import test from 'node:test';
import assert from 'node:assert/strict';
import {planOfflineSync,verifyRemoteSnapshot} from '../public/src/data/offline-outbox.js?v=1.19.2';
const blank={routines:[],records:[],habits:[],checks:{},onboardSeen:true};
const records=[{id:'run1',type:'run',name:'Running',date:'2026-11-19',minutes:19.26},{id:'run2',type:'run',name:'Running',date:'2026-11-16',minutes:14.29}];
test('pending legacy decimal minutes survive three-way merge and verification',()=>{
  const remote={...blank,records:[{id:'mac1',type:'run',name:'Mac fixture',date:'2026-11-18',minutes:12}]};
  const result=planOfflineSync(blank,{...blank,records},remote);
  assert.equal(result.safe,true);
  assert.equal(result.snapshot.records.find(x=>x.id==='run1').minutes,19.26);
  assert.equal(result.snapshot.records.find(x=>x.id==='run2').minutes,14.29);
  assert.ok(result.snapshot.records.some(x=>x.id==='mac1'));
  assert.ok(verifyRemoteSnapshot(result.snapshot,JSON.parse(JSON.stringify(result.snapshot))));
  const rounded=JSON.parse(JSON.stringify(result.snapshot));rounded.records.find(x=>x.id==='run1').minutes=19;
  assert.equal(verifyRemoteSnapshot(result.snapshot,rounded),false);
});
