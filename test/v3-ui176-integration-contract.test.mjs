import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAuthService} from '../mobile-session22/auth-server.mjs';
import {LocalAuditJournal} from '../mobile-session22/durable-journal.mjs';
import {createReferenceGateway} from '../mobile-session22/integration-gateway.mjs';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'a2s-ui176-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const journal=new LocalAuditJournal(join(dir,'audit.ndjson'));await journal.load();
 const service=createAuthService({allowLocalHttpForTests:true,accounts:[
  {id:'DR-1',login:'driver-test',password:'long-driver-test-password',role:'driver',
   organizationId:'SCHOOL-A',assignedTripIds:['TRIP-1']},
  {id:'PA-1',login:'parent-test',password:'long-parent-test-password',role:'parent',
   organizationId:'SCHOOL-A',authorizedStudentIds:['E-01']}
 ]});
 const server=service.listen();
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 async function login(login,password){
  const res=await fetch(base+'/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({login,password})});
  return (await res.json()).token;
 }
 return {gateway:createReferenceGateway({authBaseUrl:base,journal,testOnly:true}),journal,login,base,service};
}
test('UI176/01: reference gateway cannot start in operational mode',()=>{
 assert.throws(()=>createReferenceGateway({testOnly:false}),/OPERATIONAL_INTEGRATION_DISABLED/);
});
test('UI176/02: authenticated assigned driver authorized with persisted audit record',async t=>{
 const h=await fixture(t),token=await h.login('driver-test','long-driver-test-password');
 const decision=await h.gateway.authorize({token,action:'trip.start',
   resource:{organizationId:'SCHOOL-A',tripId:'TRIP-1'}});
 assert.equal(decision.ok,true);
 const again=new LocalAuditJournal(h.journal.path);
 assert.equal((await again.load())[0].event.decision,'ALLOWED');
});
test('UI176/03: parent may read only linked child; denial audited',async t=>{
 const h=await fixture(t),token=await h.login('parent-test','long-parent-test-password');
 const good=await h.gateway.authorize({token,action:'child.read',
  resource:{organizationId:'SCHOOL-A',studentId:'E-01'}});
 const bad=await h.gateway.authorize({token,action:'child.read',
  resource:{organizationId:'SCHOOL-A',studentId:'E-02'}});
 assert.equal(good.ok,true);assert.equal(bad.code,'PARENT_CHILD_DENIED');
 assert.deepEqual(h.journal.snapshot().map(x=>x.event.decision),['ALLOWED','DENIED']);
});
test('UI176/04: audit outage fails closed',async t=>{
 const h=await fixture(t),token=await h.login('driver-test','long-driver-test-password');
 const failing=createReferenceGateway({authBaseUrl:h.base,testOnly:true,journal:{
  append:async()=>{throw Error('DISK_FULL');}
 }});
 assert.equal((await failing.authorize({token,action:'trip.start',
  resource:{organizationId:'SCHOOL-A',tripId:'TRIP-1'}})).code,'AUDIT_UNAVAILABLE');
});
test('UI176/05: unavailable auth service and bad input fail closed',async t=>{
 const h=await fixture(t);
 assert.equal((await h.gateway.authorize({token:'',action:'trip.start',resource:{}})).ok,false);
 const offline=createReferenceGateway({authBaseUrl:'http://127.0.0.1:1',journal:h.journal,testOnly:true});
 assert.equal((await offline.authorize({token:'test',action:'trip.start',resource:{}})).code,'AUTH_SERVICE_UNAVAILABLE');
});
test('UI176/06: bearer token and student identity are not persisted in gateway audit',async t=>{
 const h=await fixture(t),token=await h.login('parent-test','long-parent-test-password');
 await h.gateway.authorize({token,action:'child.read',resource:{organizationId:'SCHOOL-A',studentId:'E-01'}});
 const serialized=JSON.stringify(h.journal.snapshot());
 assert.equal(serialized.includes(token),false);
 assert.equal(serialized.includes('E-01'),false);
});
test.todo('UI176/REAL: authenticate trusted operational identities using institution-managed IdP');
test.todo('UI176/REAL: real transactional audit, distributed session revocation and data storage');
test.todo('UI176/REAL: integrate full Android apps and offline conflict-proof synchronization');
