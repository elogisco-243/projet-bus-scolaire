import test from 'node:test';
import assert from 'node:assert/strict';
import {createSync08CapacitorBridge} from '../registration.mjs';
const state={version:1,provider:'native_encrypted_sqlite',atomicRevision:true,
 deviceWideLease:true,locked:false};
function fake(){
 let opened=0,locked=false,reads=0;
 const plugin={
  inspect:async()=>state,
  acquireLease:async({partition})=>{if(locked)throw Error('LOCKED');
   locked=partition;return {token:'unique-token-01234567890123'};},
  read:async({partition,token})=>{reads++;if(partition!==locked||token!=='unique-token-01234567890123')throw Error('DENIED');return {revision:0,items:[]};},
  compareAndSwap:async()=>({revision:1}),
  releaseLease:async({token})=>{if(token!=='unique-token-01234567890123')throw Error('DENIED');locked=false;}
 };
 return {plugin,get opened(){return opened;},get reads(){return reads;},
  registerPlugin:(name)=>{assert.equal(name,'A2SScolaSecureQueue');opened++;return plugin;}};
}
test('opt-in is required; does not register native plugin when disabled',()=>{
 const f=fake();
 for(const args of [{},{enabled:true,mode:'production',platform:'android'},
   {enabled:true,mode:'staging',platform:'web'},
   {enabled:false,mode:'staging',platform:'android'}])
  assert.throws(()=>createSync08CapacitorBridge({...args,registerPlugin:f.registerPlugin}),
    e=>e.code==='SYNC08_DISABLED');
 assert.equal(f.opened,0);
});
test('registration requires real Capacitor injected registerPlugin',()=>{
 assert.throws(()=>createSync08CapacitorBridge({enabled:true,mode:'staging',
   platform:'android'}),/CAPACITOR_REGISTER_PLUGIN_REQUIRED/);
});
test('native plugin registered only in explicit staging; scoped lease protocol works',async()=>{
 const f=fake();
 const bridge=createSync08CapacitorBridge({registerPlugin:f.registerPlugin,
   enabled:true,mode:'staging',platform:'android'});
 assert.equal(f.opened,1);
 assert.equal((await bridge.inspect()).provider,'native_encrypted_sqlite');
 await bridge.withExclusiveLease('partition-1',async()=>{
   const r=await bridge.read('partition-1');
   assert.equal(r.revision,0);
   assert.equal((await bridge.compareAndSwap('partition-1',0,[])).revision,1);
   await assert.rejects(()=>bridge.read('partition-2'),e=>e.code==='NATIVE_LEASE_REQUIRED');
 });
 assert.equal(f.reads,1);
});
test('failed operation releases native file lock',async()=>{
 const f=fake();
 const bridge=createSync08CapacitorBridge({registerPlugin:f.registerPlugin,
   enabled:true,mode:'staging',platform:'android'});
 await assert.rejects(()=>bridge.withExclusiveLease('partition-1',async()=>{
   throw Error('SHUTDOWN');
 }),/SHUTDOWN/);
 await bridge.withExclusiveLease('partition-1',async()=>{
   assert.equal((await bridge.read('partition-1')).revision,0);
 });
});
