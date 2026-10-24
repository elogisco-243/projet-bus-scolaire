import test from 'node:test';
import assert from 'node:assert/strict';
import {createSync06DurableRunner} from '../durable.mjs';
import {validateServerAssignment,createSync06AuthorizedTransport} from '../assignment.mjs';
const actorId='11111111-1111-4111-8111-111111111111';
const schoolId='22222222-2222-4222-8222-222222222222';
const operatorId='33333333-3333-4333-8333-333333333333';
const tripId='44444444-4444-4444-8444-444444444444';
const studentId='55555555-5555-4555-8555-555555555555';
const otherStudent='66666666-6666-4666-8666-666666666666';
const stopId='77777777-7777-4777-8777-777777777777';
const eventId='88888888-8888-4888-8888-888888888888';
const now=Date.parse('2026-10-22T12:00:00.000Z');
const context={actorId,schoolId,operatorId,tripId,mode:'staging'};
const pointage=(id=eventId)=>({id,tripId,studentId,stopId,type:'board',
 occurredAt:'2026-10-22T11:00:00.000Z',attempts:0,status:'pending'});
const assignment=(x={})=>({source:'authenticated_v3',active:true,role:'attendant',
 permission:'pointage:write',actorId,schoolId,operatorId,tripId,
 studentIds:[studentId],stopIds:[stopId],issuedAt:now-60000,expiresAt:now+60000,...x});
function nativeBridge({seed=[pointage()],state,failOnAck=false}={}){
 const buckets=new Map(),locks=new Map();let writes=0,inspects=0,fail=failOnAck;
 const bridge={
  inspect:async()=>{inspects++;return state||{
   version:1,provider:'native_encrypted_sqlite',atomicRevision:true,
   deviceWideLease:true,locked:false
  };},
  withExclusiveLease:async(k,fn)=>{
   const prev=locks.get(k)||Promise.resolve();
   let unlock;const mine=new Promise(r=>{unlock=r;});
   locks.set(k,prev.then(()=>mine));
   await prev;
   try{return await fn();}finally{unlock();}
  },
  read:async k=>structuredClone(buckets.get(k)||{revision:0,items:seed}),
  compareAndSwap:async(k,revision,items)=>{
   const existing=buckets.get(k)||{revision:0,items:seed};
   if(revision!==existing.revision)throw Error('CAS_CONFLICT');
   if(fail&&items.some(e=>e.status==='synced')){
    fail=false;throw Error('DISK_FULL');
   }
   const next=structuredClone({revision:revision+1,items});
   buckets.set(k,next);writes++;
   return {revision:next.revision};
  }
 };
 return {bridge,buckets,get writes(){return writes;},get inspects(){return inspects;},
  get latest(){return [...buckets.values()].at(-1)||{revision:0,items:seed};}};
}
function server(){
 const ledger=new Map();let online=true,lostAck=false,calls=0;
 const transport={
  async sendPointage(e){
   calls++;
   if(!online)throw Error('NETWORK_DOWN');
   const prior=ledger.get(e.id);
   if(prior&&JSON.stringify(prior)!==JSON.stringify(e))throw Error('EVENT_CONFLICT');
   if(!prior)ledger.set(e.id,structuredClone(e));
   if(lostAck){lostAck=false;throw Error('ACK_LOST');}
   return {result:prior?'already_recorded':'recorded',sequenceNo:1};
  }
 };
 return {transport,ledger,setOnline:v=>{online=v;},loseAck:()=>{lostAck=true;},
  get calls(){return calls;}};
}
function runner(n,s,{enabled=true,ctx=context,fetchAssignment=async()=>assignment()}={}){
 return createSync06DurableRunner({bridge:n.bridge,transport:s.transport,context:ctx,
  loadVerifiedAssignment:fetchAssignment,enabled,now:()=>now});
}
test('disabled by default, not even native storage inspected',async()=>{
 const n=nativeBridge(),s=server();
 const r=runner(n,s,{enabled:false});
 await assert.rejects(()=>r.run(),e=>e.code==='SYNC06_DISABLED');
 assert.equal(n.inspects,0);assert.equal(s.calls,0);
});
test('reject nonnative, unencrypted, unlocked unknown and missing lease before any network',async()=>{
 for(const state of [{version:1,provider:'localStorage',atomicRevision:true,deviceWideLease:true,locked:false},
  {version:1,provider:'native_encrypted_sqlite',atomicRevision:false,deviceWideLease:true,locked:false},
  {version:1,provider:'native_encrypted_sqlite',atomicRevision:true,deviceWideLease:false,locked:false},
  {version:1,provider:'native_encrypted_sqlite',atomicRevision:true,deviceWideLease:true,locked:true}]){
  const n=nativeBridge({state}),s=server();
  await assert.rejects(()=>runner(n,s).run(),e=>e.code==='SECURE_NATIVE_STORAGE_REQUIRED');
  assert.equal(s.calls,0);
 }
});
test('reject operational mode and demo UUID storage partition',()=>{
 const n=nativeBridge(),s=server();
 assert.throws(()=>runner(n,s,{ctx:{...context,mode:'production'}}),e=>e.code==='STAGING_CONTEXT_REQUIRED');
 assert.throws(()=>runner(n,s,{ctx:{...context,tripId:'00000000-0000-4000-8000-000000000001'}}),
  e=>e.code==='STAGING_CONTEXT_REQUIRED');
});
test('validated signed-session assignment must match actor, trip, school and operator',()=>{
 assert.equal(validateServerAssignment(assignment(),context,now).role,'attendant');
 for(const altered of [{actorId:otherStudent},{schoolId:otherStudent},
    {operatorId:otherStudent},{tripId:otherStudent},{source:'UI_PROFILE'},
    {active:false},{role:'parent'},{permission:'read'},{expiresAt:now-1},
    {issuedAt:now+100000},{studentIds:['A-01']},{stopIds:[]}]){
  assert.throws(()=>validateServerAssignment(assignment(altered),context,now),e=>e.kind==='review');
 }
});
test('authorized event is sent once, acknowledgement committed to atomic CAS',async()=>{
 const n=nativeBridge(),s=server();
 const out=await runner(n,s).run();
 assert.equal(out.stats.confirmed,1);
 assert.equal(n.latest.items[0].status,'synced');
 assert.equal(n.latest.items[0].serverSequenceNo,1);
 assert.equal(n.latest.revision,2);
 assert.equal(s.ledger.size,1);
});
test('offline queue stays pending, then reconnects with original UUID',async()=>{
 const n=nativeBridge(),s=server(),r=runner(n,s);
 s.setOnline(false);
 assert.equal((await r.run()).stats.halted,'NETWORK_UNAVAILABLE');
 assert.equal(n.latest.items[0].status,'pending');
 s.setOnline(true);
 assert.equal((await r.run()).stats.confirmed,1);
 assert.equal(n.latest.items[0].id,eventId);
 assert.equal(n.latest.items[0].attempts,2);
});
test('ACK lost after server commit is replayed without duplication',async()=>{
 const n=nativeBridge(),s=server(),r=runner(n,s);
 s.loseAck();
 assert.equal((await r.run()).stats.halted,'NETWORK_UNAVAILABLE');
 assert.equal(s.ledger.size,1);
 assert.equal(n.latest.items[0].status,'pending');
 await r.run();
 assert.equal(n.latest.items[0].serverResult,'already_recorded');
 assert.equal(s.ledger.size,1);
});
test('native disk failure after ACK retains pending event for idempotent retry',async()=>{
 const n=nativeBridge({failOnAck:true}),s=server(),r=runner(n,s);
 assert.equal((await r.run()).stats.halted,'NETWORK_UNAVAILABLE');
 assert.equal(n.latest.items[0].status,'pending');
 assert.equal(s.ledger.size,1);
 assert.equal((await r.run()).stats.confirmed,1);
 assert.equal(n.latest.items[0].serverResult,'already_recorded');
});
test('two concurrent runners share OS-level lease and cannot double-commit',async()=>{
 const n=nativeBridge(),s=server(),a=runner(n,s),b=runner(n,s);
 const [x,y]=await Promise.all([a.run(),b.run()]);
 assert.deepEqual([x.stats.confirmed,y.stats.confirmed].sort(),[0,1]);
 assert.equal(s.calls,1);
 assert.equal(n.latest.items[0].status,'synced');
});
test('expired assignment and parent role halt sends, preserve pending data',async()=>{
 for(const bad of [{expiresAt:now-1},{role:'parent'}]){
  const n=nativeBridge(),s=server();
  const o=await runner(n,s,{fetchAssignment:async()=>assignment(bad)}).run();
  assert.ok(o.stats.halted?.startsWith('ASSIGNMENT_'));
  assert.equal(n.latest.items[0].status,'pending');
  assert.equal(s.calls,0);
 }
});
test('changed trip, child or stop scope prevents uploads',async()=>{
 const configs=[
  {studentIds:[otherStudent]},
  {stopIds:[otherStudent]},
  {tripId:otherStudent}
 ];
 for(const x of configs){
  const n=nativeBridge(),s=server();
  const o=await runner(n,s,{fetchAssignment:async()=>assignment(x)}).run();
  assert.ok(o.stats.halted?.startsWith('ASSIGNMENT_'));
  assert.equal(s.calls,0);
 }
});
test('demo history never gets remapped or uploaded automatically',async()=>{
 const local={...pointage(),tripId:'00000000-0000-4000-8000-000000000001'};
 const n=nativeBridge({seed:[local]}),s=server();
 const o=await runner(n,s).run();
 assert.equal(o.stats.halted,'UNMAPPED_OR_DEMO_ID');
 assert.equal(n.latest.items[0].status,'pending');
 assert.equal(s.calls,0);
});
test('alerts and stop arrivals remain in queue; not sent as pointages',async()=>{
 const stop={...pointage(),type:'stop_arrival',studentId:null};
 const n=nativeBridge({seed:[stop]}),s=server();
 const o=await runner(n,s).run();
 assert.equal(o.stats.skipped,1);assert.equal(s.calls,0);
 assert.equal(n.latest.items[0].status,'pending');
});
test('duplicate event UUID corrupts queue and blocks the entire flush',async()=>{
 const n=nativeBridge({seed:[pointage(),{...pointage(),type:'alight'}]}),s=server();
 await assert.rejects(()=>runner(n,s).run(),e=>e.code==='QUEUE_INVALID');
 assert.equal(s.calls,0);
});
test('native CAS conflict fails closed without acknowledging the pointage',async()=>{
 const n=nativeBridge(),s=server();
 n.bridge.compareAndSwap=async()=>{throw Error('CONFLICT');};
 await assert.rejects(()=>runner(n,s).run(),/CONFLICT/);
 assert.equal(s.calls,0);
});
test('native partition is isolated per actor/organization/trip',async()=>{
 const n=nativeBridge(),s=server();
 const c2={...context,actorId:'99999999-9999-4999-8999-999999999999'};
 const out=await runner(n,s).run();
 assert.equal(out.stats.confirmed,1);
 const fresh=await runner(n,s,{ctx:c2,fetchAssignment:async()=>assignment({actorId:c2.actorId})}).run();
 assert.equal(fresh.stats.confirmed,1);
 assert.equal(n.buckets.size,2);
});
