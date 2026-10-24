import test from 'node:test';
import assert from 'node:assert/strict';
import {createSync07ScopedBridge} from '../bridge.mjs';
import {createSync06DurableRunner} from '../../mobile-sync06/durable.mjs';
const actorId='11111111-1111-4111-8111-111111111111';
const schoolId='22222222-2222-4222-8222-222222222222';
const operatorId='33333333-3333-4333-8333-333333333333';
const tripId='44444444-4444-4444-8444-444444444444';
const studentId='55555555-5555-4555-8555-555555555555';
const stopId='66666666-6666-4666-8666-666666666666';
const id='77777777-7777-4777-8777-777777777777';
const time=Date.parse('2026-10-22T12:00:00Z');
const context={actorId,schoolId,operatorId,tripId,mode:'staging'};
const record=()=>({id,tripId,studentId,stopId,occurredAt:'2026-10-22T11:00:00.000Z',
 type:'board',status:'pending',attempts:0});
function plugin(){
 const db=new Map();let lease=null,number=0;
 const checks=()=>({version:1,provider:'native_encrypted_sqlite',
   atomicRevision:true,deviceWideLease:true,locked:false});
 return {
  get records(){return db;},get activeLease(){return lease;},
  async inspect(){return checks();},
  async acquireLease({partition}){
   if(lease)throw Error('LEASE_BUSY');lease={partition,token:'lease-'+(++number)+'-long-random-token'};
   return {token:lease.token};
  },
  async releaseLease({token}){
   if(lease?.token!==token)throw Error('WRONG_LEASE');lease=null;
  },
  async read({partition,token}){
   if(lease?.partition!==partition||lease.token!==token)throw Error('DENIED');
   return structuredClone(db.get(partition)||{revision:0,items:[record()]});
  },
  async compareAndSwap({partition,token,revision,items}){
   if(lease?.partition!==partition||lease.token!==token)throw Error('DENIED');
   const old=db.get(partition)||{revision:0,items:[record()]};
   if(old.revision!==revision)throw Error('STALE');
   const next=structuredClone({revision:revision+1,items});
   db.set(partition,next);
   return {revision:next.revision};
  }
 };
}
function runner(p){
 const bridge=createSync07ScopedBridge({plugin:p});
 const sent=[];
 const transport={async sendPointage(e){
  sent.push(e);
  return {result:sent.length>1?'already_recorded':'recorded',sequenceNo:1};
 }};
 return {runner:createSync06DurableRunner({bridge,transport,context,enabled:true,
  loadVerifiedAssignment:async()=>({
   source:'authenticated_v3',active:true,role:'attendant',permission:'pointage:write',
   ...context,studentIds:[studentId],stopIds:[stopId],issuedAt:time-1000,expiresAt:time+60000
  }),now:()=>time}),sent,bridge};
}
test('native plugin missing is fail-closed, no localStorage fallback',()=>{
 assert.throws(()=>createSync07ScopedBridge(),/NATIVE_PLUGIN_REQUIRED/);
});
test('native JS scoped token is required for reads and writes',async()=>{
 const p=plugin(),a=createSync07ScopedBridge({plugin:p});
 await assert.rejects(()=>a.read('anything'),e=>e.code==='NATIVE_LEASE_REQUIRED');
 await assert.rejects(()=>a.compareAndSwap('anything',0,[]),e=>e.code==='NATIVE_LEASE_REQUIRED');
});
test('actual SYNC-06 runner works against SYNC-07 plugin protocol',async()=>{
 const p=plugin(),r=runner(p);
 const result=await r.runner.run();
 assert.equal(result.stats.confirmed,1);
 assert.equal(p.activeLease,null);
 assert.equal([...p.records.values()][0].revision,2);
 assert.equal([...p.records.values()][0].items[0].status,'synced');
 assert.deepEqual(Object.keys(r.sent[0]).sort(),['id','tripId','studentId','stopId','type','occurredAt'].sort());
});
test('lease released after callback failure; next run can resume same UUID',async()=>{
 const p=plugin(),a=createSync07ScopedBridge({plugin:p});
 await assert.rejects(()=>a.withExclusiveLease('x',async()=>{throw Error('SIMULATED_CRASH');}),/SIMULATED_CRASH/);
 assert.equal(p.activeLease,null);
 const result=await runner(p).runner.run();
 assert.equal(result.stats.confirmed,1);
});
test('two JS runners sharing native plugin: exactly one confirmation',async()=>{
 const p=plugin(),a=runner(p),b=runner(p);
 const outcomes=await Promise.allSettled([a.runner.run(),b.runner.run()]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
 assert.equal([...p.records.values()][0].revision,2);
 assert.equal(p.activeLease,null);
});
test('separate partitions are not exposed to a held lease',async()=>{
 const p=plugin(),a=createSync07ScopedBridge({plugin:p});
 await a.withExclusiveLease('one',async()=>{
  await assert.rejects(()=>a.read('two'),e=>e.code==='NATIVE_LEASE_REQUIRED');
 });
});
