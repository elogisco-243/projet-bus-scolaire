'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {generateKeyPairSync,sign}=require('node:crypto');
const {createJwtVerifier}=require('../src/v3/jwt');
const {createSync04WriteApi}=require('../src/v3/sync04-write-api');
const {createSync04PgWriter}=require('../src/v3/sync04-pg-writer');
const ID='11111111-1111-4111-8111-111111111111';
const T='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333';
const S='44444444-4444-4444-8444-444444444444';
const E='55555555-5555-4555-8555-555555555555';
const key=generateKeyPairSync('rsa',{modulusLength:2048});
const now=Math.floor(Date.now()/1000);
const issuer='https://ci-only.invalid/';
const audience='scola-test';
const verifier=createJwtVerifier({issuer,audience,publicKeyPem:key.publicKey.export({format:'pem',type:'spki'})});
function token(sub='known',actorId=ID) {
 const h=Buffer.from(JSON.stringify({typ:'at+jwt',alg:'RS256'})).toString('base64url');
 const b=Buffer.from(JSON.stringify({iss:issuer,aud:audience,sub,actor_id:actorId,iat:now-5,exp:now+180})).toString('base64url');
 return h+'.'+b+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+b),key.privateKey).toString('base64url');
}
const input={id:E,tripId:T,studentId:C,stopId:S,type:'board',occurredAt:new Date().toISOString()};
function fixture(overrides={}) {
 const stored=[];
 const actor={userId:ID,identitySubject:'known',memberships:[]};
 const handler=createSync04WriteApi({
  verifyToken:verifier,
  loadActor:async(sub,verified)=>sub==='known'&&verified.actorId===ID?actor:null,
  saveEvent:async(a,e)=>{
   stored.push({a,e});
   if(overrides.error)throw overrides.error;
   return overrides.response||{result:'recorded',sequenceNo:1};
  }
 });
 return {handler,stored};
}
async function serve(fixture,callback) {
 const server=http.createServer(fixture.handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const call=async(overrides={})=>{
  const auth=overrides.auth===undefined?'Bearer '+token():overrides.auth;
  const headers={'content-type':'application/json',...overrides.headers};
  if(auth!==null)headers.authorization=auth;
  const res=await fetch(origin+(overrides.path||'/api/v3/sync/events'),{
   method:overrides.method||'POST',headers,
   body:(overrides.method||'POST')==='POST'?
     typeof overrides.payload==='string'?overrides.payload:JSON.stringify(overrides.payload||input):undefined,
   signal:AbortSignal.timeout(3000)
  });
  return {status:res.status,body:await res.json(),headers:res.headers};
 };
 try{await callback(call);}finally{await new Promise(r=>server.close(r));}
}
test('signed JWT, allowlist, 201 receipt and no client-provided actor privilege',async()=>{
 const f=fixture();
 await serve(f,async call=>{
  const x=await call({payload:{...input,actorUserId:'hacker',role:'operator_admin',parkedConfirmed:true}});
  assert.equal(x.status,201);
  assert.deepEqual(x.body,{eventId:E,result:'recorded',sequenceNo:1});
  assert.equal(x.headers.get('cache-control'),'no-store');
  assert.equal(f.stored.length,1);
  assert.deepEqual(Object.keys(f.stored[0].e).sort(),['id','tripId','studentId','stopId','type','occurredAt'].sort());
  assert.equal(f.stored[0].a.userId,ID);
 });
});
test('no auth, invalid JWT and wrong authenticated subject are denied',async()=>{
 const f=fixture();
 await serve(f,async call=>{
  assert.equal((await call({auth:null})).status,401);
  assert.equal((await call({auth:'Bearer fake'})).status,401);
  assert.equal((await call({auth:'Bearer '+token('unknown')})).status,401);
  assert.equal(f.stored.length,0);
 });
});
test('write route rejects GET and unrelated URL',async()=>{
 const f=fixture();
 await serve(f,async call=>{
  assert.equal((await call({method:'GET'})).status,405);
  assert.equal((await call({path:'/api/v3/sync/elsewhere'})).status,404);
 });
});
test('invalid body and alien action are rejected before DB',async()=>{
 const f=fixture();
 await serve(f,async call=>{
  assert.equal((await call({payload:'{invalid'})).status,400);
  assert.equal((await call({payload:{...input,type:'stop'}})).status,422);
  assert.equal((await call({payload:'"'.repeat(5000)})).status,413);
  assert.equal((await call({headers:{'content-type':'text/plain'}})).status,415);
  assert.equal(f.stored.length,0);
 });
});
test('database duplicate receipt is 200; no repeat insert required',async()=>{
 const f=fixture({response:{result:'already_recorded',sequenceNo:7}});
 await serve(f,async call=>{
  const x=await call();
  assert.equal(x.status,200);
  assert.deepEqual(x.body,{eventId:E,result:'already_recorded',sequenceNo:7});
 });
});
test('authorization, conflict and unavailable SQL are mapped without details',async()=>{
 for(const [code,status] of [['42501',403],['23505',409],['23514',409],['XX000',503]]){
  const f=fixture({error:Object.assign(Error('sensitive SQL information'),{code})});
  await serve(f,async call=>{
   const x=await call();
   assert.equal(x.status,status);
   assert.ok(!JSON.stringify(x.body).includes('sensitive SQL'));
  });
 }
});
test('writer uses restricted SQL role, signed actor, one transaction, correct params',async()=>{
 const calls=[];let released=false;
 const db={query:async(...args)=>{
  calls.push(args);
  if(args[0].includes('current_user AS role'))return {rows:[{role:'bus_v3_writer',read_only:'off'}]};
  if(args[0].includes('AS receipt'))return {rows:[{receipt:{result:'recorded',sequenceNo:2}}]};
  return {rows:[]};
 },release:()=>{released=true;}};
 const writer=createSync04PgWriter({pool:{connect:async()=>db},signingSecretHex:'ab'.repeat(32)});
 const answer=await writer.saveEvent({userId:ID},input);
 assert.deepEqual(answer,{result:'recorded',sequenceNo:2});
 assert.equal(calls[0][0],'BEGIN');
 assert.equal(calls[1][0],'SET LOCAL ROLE bus_v3_writer');
 assert.deepEqual(calls[4][1],[E,T,C,S,'board',input.occurredAt]);
 assert.equal(calls.at(-1)[0],'COMMIT');
 assert.equal(released,true);
});
test('writer wrong SQL role fails closed with rollback and release',async()=>{
 const calls=[];let released=false;
 const db={query:async(sql)=>{calls.push(sql);return sql.includes('current_user')?
  {rows:[{role:'postgres',read_only:'off'}]}:{rows:[]};},release:()=>{released=true;}};
 const writer=createSync04PgWriter({pool:{connect:async()=>db},signingSecretHex:'ab'.repeat(32)});
 await assert.rejects(()=>writer.saveEvent({userId:ID},input),/ROLE_NOT_ENFORCED/);
 assert.equal(calls.at(-1),'ROLLBACK');assert.equal(released,true);
});
test('writer rolls back DB errors; never acknowledges an uncommitted event',async()=>{
 const calls=[];
 const db={query:async(sql)=>{
  calls.push(sql);
  if(sql.includes('current_user AS role'))return {rows:[{role:'bus_v3_writer',read_only:'off'}]};
  if(sql.includes('AS receipt'))throw Object.assign(Error('db-conflict'),{code:'23505'});
  return {rows:[]};
 },release:()=>{calls.push('RELEASE');}};
 const writer=createSync04PgWriter({pool:{connect:async()=>db},signingSecretHex:'ab'.repeat(32)});
 await assert.rejects(()=>writer.saveEvent({userId:ID},input),e=>e.code==='23505');
 assert.equal(calls.at(-2),'ROLLBACK');assert.equal(calls.at(-1),'RELEASE');
});
