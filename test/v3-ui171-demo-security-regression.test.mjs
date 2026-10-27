/** UI-171: security regression tests of LOCAL DEMO HTTP only.
 * No production authentication, persistence or offline queue is implied.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoHub} from '../mobile-session21/demo-hub.mjs';

async function fixture(t) {
  const server=createDemoHub().listen({port:0});
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return 'http://127.0.0.1:'+server.address().port;
}
async function request(base,path,{token,method='GET',body,headers={}}={}) {
  const r=await fetch(base+path,{method,headers:{
    ...(token?{authorization:'Bearer '+token}:{}),
    ...(body!==undefined?{'content-type':'application/json'}:{}),...headers
  },...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:r.status,data:await r.json()};
}
async function join(base,profile) {
  const r=await request(base,'/api/join',{method:'POST',body:{profile}});
  assert.equal(r.status,200);
  return r.data.token;
}
async function state(base,token) {
  const r=await request(base,'/api/state',{token});
  assert.equal(r.status,200);
  return r.data.snapshot;
}
async function command(base,token,type,payload={},commandId='UI171-COMMAND-01',revision) {
  const snap=await state(base,token);
  return request(base,'/api/action',{token,method:'POST',body:{
    type,payload,commandId,expectedRevision:revision??snap.revision
  }});
}
test('UI171/SEC01: demo announces explicitly that real identity and device linking are absent',async t=>{
  const base=await fixture(t);
  const r=await request(base,'/api/health');
  assert.equal(r.status,200);
  assert.equal(r.data.mode,'DEMO_ONLY');
  assert.equal(r.data.realAuthentication,false);
  assert.equal(r.data.connectedDevices,false);
});
test('UI171/SEC02: missing, bogus or malformed bearer token cannot read a pupil snapshot',async t=>{
  const base=await fixture(t);
  assert.equal((await request(base,'/api/state')).status,401);
  assert.equal((await request(base,'/api/state',{token:'FAKE-TOKEN'})).status,401);
  assert.equal((await request(base,'/api/state',{headers:{authorization:'Basic abcd'}})).status,401);
});
test('UI171/SEC03: Parent isolation and cross-role command rejection are enforced server-side in demo',async t=>{
  const base=await fixture(t);
  const p=await join(base,'parent'),p2=await join(base,'parent2'),a=await join(base,'accompagnateur');
  assert.deepEqual((await state(base,p)).children.map(x=>x.studentId),['E-01']);
  assert.deepEqual((await state(base,p2)).children.map(x=>x.studentId),['E-02']);
  assert.equal((await command(base,p,'start',{},'UI171-DENY-START')).status,403);
  assert.equal((await command(base,p,'notify_absence',{studentId:'E-02',reason:'family_notified'},'UI171-DENY-CHILD')).status,403);
  assert.equal((await command(base,a,'review_change_demo',{requestId:'REQ-DEMO-X',demoPolicyApproved:true},'UI171-DENY-SUP')).status,403);
});
test('UI171/SEC04: stale revisions, duplicate command and inconsistent retry are handled',async t=>{
  const base=await fixture(t),a=await join(base,'accompagnateur');
  const initial=(await state(base,a)).revision;
  const first=await command(base,a,'ready',{},'UI171-IDEMPOTENT-01',initial);
  assert.equal(first.status,200);
  assert.equal(first.data.accepted,true);
  const replay=await command(base,a,'ready',{},'UI171-IDEMPOTENT-01',initial);
  assert.equal(replay.status,200);
  assert.equal(replay.data.alreadyApplied,true);
  assert.equal((await state(base,a)).revision,initial+1);
  const conflict=await command(base,a,'ready',{altered:true},'UI171-IDEMPOTENT-01',initial);
  assert.equal(conflict.data.error,'IDEMPOTENCY_CONFLICT');
  assert.equal((await command(base,a,'ready',{},'UI171-STALE-001',initial)).status,409);
});
test('UI171/SEC05: a client reconnection reads latest in-memory state, but restart is not persistence',async t=>{
  const base=await fixture(t),a=await join(base,'accompagnateur'),d=await join(base,'chauffeur');
  const r=await command(base,a,'ready',{},'UI171-READY-001');
  assert.equal(r.status,200);
  assert.equal((await command(base,d,'start',{},'UI171-START-001')).status,200);
  const joinedAgain=await join(base,'accompagnateur');
  const refreshed=await state(base,joinedAgain);
  assert.equal(refreshed.status,'in_progress');
  assert.equal(refreshed.attendantReady,true);
});
test('UI171/SEC06: cross-origin join and non-supervisor reset are blocked',async t=>{
  const base=await fixture(t),p=await join(base,'parent');
  const cross=await request(base,'/api/join',{method:'POST',body:{profile:'superviseur'},headers:{origin:'https://attacker.invalid'}});
  assert.equal(cross.status,403);
  const reset=await request(base,'/api/reset',{token:p,method:'POST',body:{confirm:'RESET_DEMO_ONLY'}});
  assert.equal(reset.status,403);
});
test.todo('UI171/REAL01: production server identity, role assignment, MFA and server-side parent-child membership');
test.todo('UI171/REAL02: TLS, token expiry/revocation, rate limiting and audit integrity');
test.todo('UI171/REAL03: durable database, offline queue, replay safety across restarts and multi-device sync');
test.todo('UI171/REAL04: authenticated real-device integration tests and verification of all remaining operational controls');
