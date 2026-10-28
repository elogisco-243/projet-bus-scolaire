import test from 'node:test';
import assert from 'node:assert/strict';
import {createGolfSessionStore,createMemoryDemoStorage} from '../mobile-session19/golf-session-store.mjs';
test('initialization and four role views share a single snapshot',()=>{
 const storage=createMemoryDemoStorage();
 const store=createGolfSessionStore(storage);
 assert.equal(store.initialize().snapshot.revision,0);
 for(const role of ['driver','attendant','parent','supervisor']){
  const p=store.read(role);
  assert.equal(p.ok,true);assert.equal(p.busId,'LUB-014');assert.equal(p.stopsTotal,4);
 }
});
test('revision increments and survives store re-instantiation',()=>{
 const storage=createMemoryDemoStorage();const a=createGolfSessionStore(storage);
 const s=a.initialize().snapshot;
 s.stops[0].reached=true;s.status='in_progress';s.revision=1;
 assert.equal(a.commit(s,{expectedRevision:0}).ok,true);
 const b=createGolfSessionStore(storage);
 assert.equal(b.read('supervisor').stopsReached,1);
 assert.equal(b.read('parent').revision,1);
 assert.equal(b.commit({...s,revision:2},{expectedRevision:0}).code,'STALE_DEMO_REVISION');
});
test('invalid, corrupt and bad revision snapshots fail closed',()=>{
 const storage=createMemoryDemoStorage();const s=createGolfSessionStore(storage);
 s.initialize();const next=s.load().snapshot;next.revision=2;
 assert.equal(s.commit(next,{expectedRevision:0}).code,'REVISION_INCREMENT_REQUIRED');
 assert.equal(s.commit(next).code,'EXPECTED_REVISION_REQUIRED');
 storage.setItem('A2S_SCOLA_UI187_GOLF_DEMO_V1','{broken');
 assert.equal(s.read('driver').code,'CORRUPT_SNAPSHOT');
});
test('does not claim atomicity or real role authentication',()=>{
 const s=createGolfSessionStore(createMemoryDemoStorage());const v=s.initialize().snapshot;
 v.revision=1;const result=s.commit(v,{expectedRevision:0});
 assert.equal(result.transactional,false);
});
