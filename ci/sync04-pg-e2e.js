'use strict';
// CI ONLY: real PostgreSQL-16 writer E2E with invented school, crew and children.
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {generateKeyPairSync,sign}=require('node:crypto');
const {Pool}=require('../staging/node_modules/pg');
const {createJwtVerifier}=require('../src/v3/jwt');
const {createSync03PgReader}=require('../src/v3/sync03-pg-reader');
const {createSync04PgWriter}=require('../src/v3/sync04-pg-writer');
const {createSync04WriteApi}=require('../src/v3/sync04-write-api');
const ATT='99999999-9999-4999-8999-999999999999';
const PARENT='11111111-1111-4111-8111-111111111111';
const DRIVER='55555555-5555-4555-8555-555555555555';
const TRIP='44444444-4444-4444-8444-444444444444';
const CHILD_A='66666666-6666-4666-8666-666666666666';
const CHILD_B='77777777-7777-4777-8777-777777777777';
const STOP='88888888-8888-4888-8888-888888888888';
const EVENT_A='10000000-0000-4000-8000-000000000001';
const EVENT_B='10000000-0000-4000-8000-000000000002';
const issuer='https://ci-writer.invalid/';
const audience='a2s-scola-ci';
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const now=Math.floor(Date.now()/1000);
const token=(sub,actorId)=>{
  const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'at+jwt'})).toString('base64url');
  const b=Buffer.from(JSON.stringify({iss:issuer,aud:audience,sub,actor_id:actorId,iat:now-5,exp:now+240})).toString('base64url');
  return h+'.'+b+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+b),keys.privateKey).toString('base64url');
};
const verifyToken=createJwtVerifier({issuer,audience,
 publicKeyPem:keys.publicKey.export({format:'pem',type:'spki'})});
const base={host:'127.0.0.1',port:5432,database:'sync04_disposable',max:3};
const readerPool=new Pool({...base,user:'sync03_ci_login',password:'ci-only-reader-password'});
const writerPool=new Pool({...base,user:'sync04_ci_login',password:'ci-only-writer-password'});
const adminPool=new Pool({...base,user:'postgres',password:'ci-only-password'});
const read=createSync03PgReader({pool:readerPool,signingSecretHex:'ab'.repeat(32)});
const write=createSync04PgWriter({pool:writerPool,signingSecretHex:'ab'.repeat(32)});
const app=http.createServer(createSync04WriteApi({
 verifyToken,loadActor:read.loadActor,saveEvent:write.saveEvent
}));
test('real CI PostgreSQL pointage: restricted role, auth, replay, conflict, invalid stop, expired parked state',async()=>{
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+app.address().port;
 const post=async(payload,sub='ci:attendant',actorId=ATT,auth=true)=>{
  const headers={'content-type':'application/json','x-role':'school_admin',
    'x-parked-confirmed':'true'};
  if(auth)headers.authorization='Bearer '+token(sub,actorId);
  const res=await fetch(origin+'/api/v3/sync/events',{
    method:'POST',headers,body:JSON.stringify(payload),
    signal:AbortSignal.timeout(8000)
  });
  return {status:res.status,body:await res.json()};
 };
 const event=(id,studentId,type='alight',overrides={})=>({
  id,tripId:TRIP,studentId,stopId:STOP,type,
  occurredAt:new Date().toISOString(),...overrides
 });
 try {
  await assert.rejects(()=>writerPool.query('SELECT count(*) FROM public.trip_student_events'),
    e=>e.code==='42501');
  await assert.rejects(()=>writerPool.query('INSERT INTO public.trip_student_events DEFAULT VALUES'),
    e=>e.code==='42501');

  const valid=event(EVENT_A,CHILD_A);
  assert.equal((await post(valid,undefined,undefined,false)).status,401);
  assert.equal((await post(valid,'ci:parent',PARENT)).status,403);
  assert.equal((await post(valid,'ci:driver',DRIVER)).status,403);
  assert.equal((await post(valid,'ci:unknown',ATT)).status,401);

  const created=await post(valid);
  assert.equal(created.status,201,JSON.stringify(created));
  assert.deepEqual(created.body.result,'recorded');
  assert.equal(created.body.sequenceNo,2); // Earlier synthetic board was sequence 1.

  const repeat=await post(valid);
  assert.equal(repeat.status,200,JSON.stringify(repeat));
  assert.equal(repeat.body.result,'already_recorded');
  assert.equal(repeat.body.sequenceNo,created.body.sequenceNo);

  assert.equal((await post({...valid,studentId:CHILD_B})).status,409);
  assert.equal((await post(event('10000000-0000-4000-8000-000000000003',CHILD_A))).status,409);
  assert.equal((await post(event('10000000-0000-4000-8000-000000000004',CHILD_B,'alight',{
    stopId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  }))).status,409);

  // A second in-flight request with the same event identifier is serialized.
  const concurrent=event(EVENT_B,CHILD_B);
  const pair=await Promise.all([post(concurrent),post(concurrent)]);
  assert.deepEqual(pair.map(r=>r.status).sort(),[200,201],JSON.stringify(pair));
  assert.equal(pair[0].body.sequenceNo,2);
  assert.equal(pair[1].body.sequenceNo,2);

  await adminPool.query([
   'UPDATE public.trip_pointage_context',
   "SET parked_confirmed_at=clock_timestamp()-interval '10 minutes',",
   "parked_valid_until=clock_timestamp()-interval '6 minutes'",
   'WHERE trip_id=$1::uuid'
  ].join(' '),[TRIP]);
  const blocked=await post(event('10000000-0000-4000-8000-000000000005',CHILD_A,'board'));
  assert.equal(blocked.status,409,JSON.stringify(blocked));
  // Replays do not duplicate an accepted event after parked state expires.
  assert.equal((await post(valid)).status,200);
 } finally {
  await new Promise(r=>app.close(r));
  await readerPool.end();
  await writerPool.end();
  await adminPool.end();
 }
});
