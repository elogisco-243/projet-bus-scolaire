import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthService} from '../mobile-session22/auth-server.mjs';
const accounts=[
 {id:'DR-1',login:'driver-test',password:'test-driver-long-secret',role:'driver',organizationId:'SCHOOL-A',assignedTripIds:['TRIP-1']},
 {id:'PA-1',login:'parent-test',password:'test-parent-long-secret',role:'parent',organizationId:'SCHOOL-A',authorizedStudentIds:['STUDENT-1']},
 {id:'SU-1',login:'super-test',password:'test-super-long-secret',role:'supervisor',organizationId:'SCHOOL-A'}];
async function fixture(t,settings={}){
 const service=createAuthService({accounts,allowLocalHttpForTests:true,...settings});
 const server=service.listen();await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise(r=>server.close(r)));
 return {base:'http://127.0.0.1:'+server.address().port,service};
}
async function call(base,path,{token,body,method='POST'}={}){
 const r=await fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),
 ...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:r.status,data:await r.json()};
}
async function login(base,login,password){
 return call(base,'/login',{body:{login,password,role:'supervisor',organizationId:'SCHOOL-B'}});
}
test('UI173/01: server refuses startup without explicit local test permission',()=>{
 assert.throws(()=>createAuthService({accounts}),/TLS_GATEWAY_REQUIRED/);
});
test('UI173/02: valid credential authenticates, client-requested elevated role ignored',async t=>{
 const {base}=await fixture(t);
 const r=await login(base,'driver-test','test-driver-long-secret');
 assert.equal(r.status,200);assert.equal(r.data.role,'driver');
 assert.equal(typeof r.data.token,'string');
});
test('UI173/03: wrong or nonexistent credentials fail',async t=>{
 const {base}=await fixture(t);
 assert.equal((await login(base,'driver-test','incorrect')).status,401);
 assert.equal((await login(base,'unknown','incorrect')).status,401);
});
test('UI173/04: no session cannot authorize',async t=>{
 const {base}=await fixture(t);
 assert.equal((await call(base,'/authorize',{body:{action:'trip.start',resource:{organizationId:'SCHOOL-A',tripId:'TRIP-1'}}})).status,401);
});
test('UI173/05: assigned driver allowed and unassigned trip denied',async t=>{
 const {base}=await fixture(t),r=await login(base,'driver-test','test-driver-long-secret');
 assert.equal((await call(base,'/authorize',{token:r.data.token,body:{action:'trip.start',resource:{organizationId:'SCHOOL-A',tripId:'TRIP-1'}}})).status,200);
 assert.equal((await call(base,'/authorize',{token:r.data.token,body:{action:'trip.start',resource:{organizationId:'SCHOOL-A',tripId:'TRIP-X'}}})).status,403);
});
test('UI173/06: parent access restricted to own child',async t=>{
 const {base}=await fixture(t),r=await login(base,'parent-test','test-parent-long-secret');
 assert.equal((await call(base,'/authorize',{token:r.data.token,body:{action:'child.read',resource:{organizationId:'SCHOOL-A',studentId:'STUDENT-1'}}})).status,200);
 assert.equal((await call(base,'/authorize',{token:r.data.token,body:{action:'child.read',resource:{organizationId:'SCHOOL-A',studentId:'STUDENT-2'}}})).status,403);
});
test('UI173/07: logout revokes token immediately',async t=>{
 const {base}=await fixture(t),r=await login(base,'driver-test','test-driver-long-secret'),token=r.data.token;
 assert.equal((await call(base,'/logout',{token})).status,200);
 assert.equal((await call(base,'/authorize',{token,body:{action:'trip.start',resource:{organizationId:'SCHOOL-A',tripId:'TRIP-1'}}})).status,401);
});
test('UI173/08: session expiry is enforced',async t=>{
 let clock=100;const {base}=await fixture(t,{now:()=>clock,ttlMs:1000});
 const r=await login(base,'driver-test','test-driver-long-secret');clock=1101;
 assert.equal((await call(base,'/authorize',{token:r.data.token,body:{action:'trip.start',resource:{organizationId:'SCHOOL-A',tripId:'TRIP-1'}}})).status,401);
});
test('UI173/09: authorization decisions recorded for test audit',async t=>{
 const {base,service}=await fixture(t),r=await login(base,'driver-test','test-driver-long-secret');
 await call(base,'/authorize',{token:r.data.token,body:{action:'trip.start',resource:{organizationId:'SCHOOL-A',tripId:'TRIP-X'}}});
 assert.equal(service.audit().some(x=>x.type==='AUTHORIZE'&&x.outcome==='TRIP_ASSIGNMENT_DENIED'),true);
});
test.todo('UI173/REAL: rate limits, MFA, hardened input, rotation and secure cookies');
test.todo('UI173/REAL: TLS gateway, persistent identity/session store, audit chain');
test.todo('UI173/REAL: production integration, tenant membership and incident response');
