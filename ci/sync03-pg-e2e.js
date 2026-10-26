'use strict';
// CI-only real PostgreSQL + signed JWT HTTP E2E. All identities are invented.
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {generateKeyPairSync,sign}=require('node:crypto');
const {Pool}=require('../staging/node_modules/pg');
const {createJwtVerifier}=require('../src/v3/jwt');
const {createSync03ReadApi}=require('../src/v3/sync03-read-api');
const {createSync03PgReader}=require('../src/v3/sync03-pg-reader');

const ACTOR='11111111-1111-4111-8111-111111111111';
const TRIP='44444444-4444-4444-8444-444444444444';
const CHILD_A='66666666-6666-4666-8666-666666666666';
const CHILD_B='77777777-7777-4777-8777-777777777777';
const key=generateKeyPairSync('rsa',{modulusLength:2048});
const now=Math.floor(Date.now()/1000);
const issuer='https://ci-only-identity.invalid/';
const audience='a2s-scola-v3-e2e';
const verifyToken=createJwtVerifier({
 issuer,audience,publicKeyPem:key.publicKey.export({type:'spki',format:'pem'})
});
function jwt(subject,actorId=ACTOR){
 const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'at+jwt'})).toString('base64url');
 const claims={iss:issuer,aud:audience,sub:subject,actor_id:actorId,iat:now-5,exp:now+300};
 const body=Buffer.from(JSON.stringify(claims)).toString('base64url');
 return header+'.'+body+'.'+sign('RSA-SHA256',Buffer.from(header+'.'+body),key.privateKey).toString('base64url');
}
const base={host:'127.0.0.1',port:5432,database:'sync03_disposable',max:2};
const readerPool=new Pool({...base,user:'sync03_ci_login',password:'ci-only-reader-password'});
const adminPool=new Pool({...base,user:'postgres',password:'ci-only-password'});
const reader=createSync03PgReader({pool:readerPool,signingSecretHex:'ab'.repeat(32)});
const server=http.createServer(createSync03ReadApi({verifyToken,...reader}));
test('real PostgreSQL RLS: signed JWT, parent child isolation and immediate revocation',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const baseUrl='http://127.0.0.1:'+server.address().port;
 const get=async(path,subject='ci:parent',actor=ACTOR)=>{
  const response=await fetch(baseUrl+path,{
   headers:{authorization:'Bearer '+jwt(subject,actor),'x-role':'school_admin'},
   signal:AbortSignal.timeout(8000)
  });
  return {status:response.status,body:await response.json()};
 };
 try {
  // The restricted login itself cannot read any student events.
  await assert.rejects(()=>readerPool.query('SELECT count(*) FROM public.trip_student_events'),
    e=>e.code==='42501');

  const me=await get('/api/v3/sync/me');
  assert.equal(me.status,200);
  assert.deepEqual(me.body.memberships.map(m=>m.role),['parent']);

  const own=await get('/api/v3/sync/trips/'+TRIP+'/snapshot');
  assert.equal(own.status,200);
  assert.deepEqual(own.body.students.map(s=>s.studentId),[CHILD_A]);
  assert.equal(own.body.students[0].status,'aboard');
  assert.deepEqual(own.body.events.map(e=>e.studentId),[CHILD_A]);
  assert.equal(own.body.routeStops,undefined);
  assert.ok(!JSON.stringify(own.body).includes(CHILD_B));

  // Matching UUID is insufficient when signed subject doesn't match.
  assert.equal((await get('/api/v3/sync/me','ci:wrong-sub')).status,401);

  await adminPool.query([
    'UPDATE public.verified_parent_student_links SET revoked_at=now()',
    'WHERE parent_user_id=$1::uuid AND student_id=$2::uuid'
  ].join(' '),[ACTOR,CHILD_A]);

  const blocked=await get('/api/v3/sync/trips/'+TRIP+'/snapshot');
  assert.equal(blocked.status,404);
 } finally {
  await new Promise(r=>server.close(r));
  await readerPool.end();
  await adminPool.end();
 }
});
