'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {generateKeyPairSync,sign}=require('node:crypto');
const {createJwtVerifier,InvalidTokenError}=require('../src/v3/jwt');
const {createSync03ReadApi}=require('../src/v3/sync03-read-api');
const {createSync03PgReader}=require('../src/v3/sync03-pg-reader');
const ACTOR='11111111-1111-4111-8111-111111111111';
const SCHOOL='22222222-2222-4222-8222-222222222222';
const OP='33333333-3333-4333-8333-333333333333';
const TRIP='44444444-4444-4444-8444-444444444444';
const DRIVER='55555555-5555-4555-8555-555555555555';
const CHILD_A='66666666-6666-4666-8666-666666666666';
const CHILD_B='77777777-7777-4777-8777-777777777777';
const STOP='88888888-8888-4888-8888-888888888888';
const EVENT='99999999-9999-4999-8999-999999999999';
const SECRET='ab'.repeat(32);
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const now=Math.floor(Date.now()/1000);
const issuer='https://scola.test/';
const audience='scola-v3';
function jwt(sub,actorId=ACTOR,expires=now+90) {
 const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'at+jwt'})).toString('base64url');
 const payload={iss:issuer,aud:audience,sub,iat:now-5,exp:expires};
 if(actorId!==undefined)payload.actor_id=actorId;
 const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
 return head+'.'+body+'.'+sign('RSA-SHA256',Buffer.from(head+'.'+body),keys.privateKey).toString('base64url');
}
const verifyToken=createJwtVerifier({issuer,audience,publicKeyPem:keys.publicKey.export({format:'pem',type:'spki'})});
function mockDb({role='bus_v3_reader',subject='sub:parent',revoked=false,deny=false}={}) {
 const calls=[];
 const db={query:async(sql,params)=>{
  calls.push({sql,params});
  if(sql==='BEGIN READ ONLY'||sql==='COMMIT'||sql==='ROLLBACK'||sql==='SET LOCAL ROLE bus_v3_reader')
    return {rows:[]};
  if(sql.startsWith('SELECT\n      set_config('))return {rows:[]};
  if(sql.includes('current_user AS role'))return {rows:[{role,read_only:'on'}]};
  if(sql.includes('FROM public.users WHERE id='))
    return {rows:!deny&&params?.[0]===ACTOR&&params?.[1]===subject?[{id:ACTOR}]:[]};
  if(sql.includes('FROM public.organization_memberships m'))
    return {rows:revoked?[]:[{organizationId:SCHOOL,role:'parent',active:true}]};
  if(sql.includes('FROM public.verified_parent_student_links l'))
    return {rows:revoked?[]:[{id:CHILD_A}]};
  if(sql.includes('FROM public.trips t JOIN public.routes r'))
    return {rows:revoked?[]:[{id:TRIP,schoolId:SCHOOL,operatorId:OP,driverUserId:DRIVER,status:'in_progress',routeCode:'001'}]};
  if(sql.includes('FROM public.trip_attendants'))
    return {rows:[]};
  if(sql.includes('FROM public.trip_students'))
    return {rows:revoked?[]:[{id:CHILD_A},{id:CHILD_B}]}; // deliberately overbroad mock
  if(sql.includes('DISTINCT ON (student_id)'))
    return {rows:[{studentId:CHILD_A,action:'board'},{studentId:CHILD_B,action:'alight'}]};
  if(sql.includes('FROM public.trip_student_events'))
    return {rows:[{eventId:EVENT,studentId:CHILD_A,action:'board',occurredAt:'2026-10-22T07:00:00.000Z'},
      {eventId:STOP,studentId:CHILD_B,action:'alight',occurredAt:'2026-10-22T07:00:00.000Z'}]};
  if(sql.includes('FROM public.route_stops'))
    return {rows:[{id:STOP,sequence:1,label:'Stop test'}]};
  throw Error('Unexpected SQL in mock: '+sql.slice(0,80));
 },release:()=>{calls.push({sql:'RELEASE'});}};
 return {pool:{connect:async()=>db},calls};
}
test('JWT issuer-signed actor_id claim accepted; unsigned browser headers cannot produce identity',()=>{
 assert.deepEqual(verifyToken(jwt('sub:parent')),{subject:'sub:parent',actorId:ACTOR});
 assert.deepEqual(verifyToken(jwt('sub:parent',undefined)),{subject:'sub:parent'});
 assert.throws(()=>verifyToken(jwt('sub:parent','not-uuid')),InvalidTokenError);
});
test('RLS reader refuses tokens lacking server-controlled actor_id',async()=>{
 const d=mockDb();
 const read=createSync03PgReader({pool:d.pool,signingSecretHex:SECRET});
 assert.equal(await read.loadActor('sub:parent',verifyToken(jwt('sub:parent',undefined))),null);
 assert.equal(d.calls.length,0);
});
test('identity is bound to signed UUID AND DB identity_subject',async()=>{
 const d=mockDb({subject:'sub:real'});
 const read=createSync03PgReader({pool:d.pool,signingSecretHex:SECRET});
 assert.equal(await read.loadActor('sub:parent',verifyToken(jwt('sub:parent'))),null);
 assert.ok(d.calls.some(c=>c.sql.includes('identity_subject=$2')&&c.params[1]==='sub:parent'));
 assert.ok(d.calls.some(c=>c.sql==='ROLLBACK')===false);
});
test('all DB calls are in signed READ ONLY session with SET LOCAL ROLE',async()=>{
 const d=mockDb();
 const read=createSync03PgReader({pool:d.pool,signingSecretHex:SECRET});
 const actor=await read.loadActor('sub:parent',verifyToken(jwt('sub:parent')));
 assert.equal(actor.userId,ACTOR);
 assert.equal(actor.identitySubject,'sub:parent');
 assert.equal(JSON.stringify(actor).includes('identitySubject'),false);
 const sql=d.calls.map(x=>x.sql);
 assert.equal(sql[0],'BEGIN READ ONLY');
 assert.ok(sql[1].includes("set_config('bus_v3.actor_id', $1, true)"));
 assert.equal(sql[2],'SET LOCAL ROLE bus_v3_reader');
 assert.equal(sql.at(-2),'COMMIT');
 assert.equal(sql.at(-1),'RELEASE');
 assert.ok(d.calls.every(c=>!c.sql.includes('INSERT INTO')));
});
test('wrong current_user fails closed and always rolls back',async()=>{
 const d=mockDb({role:'postgres'});
 const read=createSync03PgReader({pool:d.pool,signingSecretHex:SECRET});
 await assert.rejects(()=>read.loadActor('sub:parent',verifyToken(jwt('sub:parent'))),/RLS_READER_REQUIRED/);
 assert.ok(d.calls.some(c=>c.sql==='ROLLBACK'));
});
test('snapshot re-reads actor and only uses parameterized trip UUID',async()=>{
 const d=mockDb();
 const read=createSync03PgReader({pool:d.pool,signingSecretHex:SECRET});
 const actor=await read.loadActor('sub:parent',verifyToken(jwt('sub:parent')));
 const ctx=await read.loadTripSnapshot(actor,TRIP);
 assert.deepEqual(ctx.tripStudentIds,[CHILD_A,CHILD_B]);
 assert.equal(ctx.routeStops[0].reached,false);
 assert.equal(ctx.studentStatuses[0].status,'aboard');
 const q=d.calls.filter(c=>c.sql.includes('FROM public.trip_students'));
 assert.equal(q.length,1);assert.deepEqual(q[0].params,[TRIP]);
 assert.equal(d.calls.filter(c=>c.sql==='BEGIN READ ONLY').length,2);
});
test('revocation on new transaction prevents the snapshot from being returned',async()=>{
 const d=mockDb();
 const read=createSync03PgReader({pool:d.pool,signingSecretHex:SECRET});
 const actor=await read.loadActor('sub:parent',verifyToken(jwt('sub:parent')));
 // Simulate DB revocation / deletion before next request.
 d.pool.connect=async()=>({
  query:async(sql)=>sql.includes('current_user AS role')?
    {rows:[{role:'bus_v3_reader',read_only:'on'}]}:{rows:[]},
  release:()=>{}
 });
 assert.equal(await read.loadTripSnapshot(actor,TRIP),null);
});
test('real signed JWT + adapter + HTTP filters out every other child',async()=>{
 const d=mockDb();
 const reader=createSync03PgReader({pool:d.pool,signingSecretHex:SECRET});
 const app=http.createServer(createSync03ReadApi({verifyToken,...reader}));
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 try {
  const origin='http://127.0.0.1:'+app.address().port;
  const req=path=>fetch(origin+path,{headers:{authorization:'Bearer '+jwt('sub:parent'),'x-role':'school_admin'}});
  const me=await req('/api/v3/sync/me');
  assert.equal(me.status,200);
  const x=await req('/api/v3/sync/trips/'+TRIP+'/snapshot');
  assert.equal(x.status,200);const payload=await x.json();
  assert.deepEqual(payload.students,[{studentId:CHILD_A,status:'aboard'}]);
  assert.deepEqual(payload.events.map(e=>e.studentId),[CHILD_A]);
  assert.ok(!JSON.stringify(payload).includes(CHILD_B));
  assert.ok(!JSON.stringify(payload).includes('identitySubject'));
  assert.equal(payload.routeStops,undefined);
 }finally {await new Promise(r=>app.close(r));}
});
