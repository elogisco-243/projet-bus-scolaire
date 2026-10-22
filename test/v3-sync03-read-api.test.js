'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {generateKeyPairSync,sign}=require('node:crypto');
const {createJwtVerifier}=require('../src/v3/jwt');
const {createSync03ReadApi}=require('../src/v3/sync03-read-api');
const S='11111111-1111-4111-8111-111111111111';
const T='22222222-2222-4222-8222-222222222222';
const O='33333333-3333-4333-8333-333333333333';
const A='44444444-4444-4444-8444-444444444444';
const B='55555555-5555-4555-8555-555555555555';
const C='66666666-6666-4666-8666-666666666666';
const D='77777777-7777-4777-8777-777777777777';
const P='88888888-8888-4888-8888-888888888888';
const H='99999999-9999-4999-8999-999999999999';
const X='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ST='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EV='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const AA='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const m=(organizationId,role,active=true)=>({organizationId,role,active});
const actors={
 parent:{userId:P,memberships:[m(S,'parent')],verifiedStudentIds:[A]},
 badParent:{userId:X,memberships:[m(T,'parent')],verifiedStudentIds:[A]},
 driver:{userId:D,memberships:[m(O,'driver')]},
 attendant:{userId:H,memberships:[m(O,'attendant')]},
 otherAttendant:{userId:X,memberships:[m(T,'attendant')]},
 admin:{userId:X,memberships:[m(S,'school_admin')]},
 disabledAttendant:{userId:H,memberships:[m(O,'attendant',false)]}
};
const baseCtx={
 trip:{id:ST,schoolId:S,operatorId:O,driverUserId:D,status:'in_progress',routeCode:'GOLF',
  SECRET:'SHOULD-NOT-LEAK'},
 tripStudentIds:[A,B],
 attendantAssignments:[{userId:H,tripId:ST,active:true,revokedAt:null}],
 studentStatuses:[{studentId:A,status:'aboard',name:'NAME-PRIVATE'},
                  {studentId:B,status:'alighted',name:'OTHER-PRIVATE'}],
 studentEvents:[{eventId:EV,studentId:A,action:'board',occurredAt:'2026-10-22T09:00:00Z',
 actorUserId:H,secret:'SECRET'},
 {eventId:AA,studentId:B,action:'alight',occurredAt:'2026-10-22T09:10:00Z'}],
 routeStops:[{id:C,sequence:1,label:'École',reached:true,latitude:1234}]
};
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const issuer='https://issuer.test/';
const audience='a2s-scola-v3';
const now=Math.floor(Date.now()/1000);
const verifier=createJwtVerifier({issuer,audience,
 publicKeyPem:keys.publicKey.export({type:'spki',format:'pem'})});
function token(sub,expires=now+300) {
 const h=Buffer.from(JSON.stringify({typ:'at+jwt',alg:'RS256'})).toString('base64url');
 const b=Buffer.from(JSON.stringify({iss:issuer,aud:audience,sub,iat:now-5,exp:expires})).toString('base64url');
 return h+'.'+b+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+b),keys.privateKey).toString('base64url');
}
async function serve(fn,overrides={}) {
 const server=http.createServer(createSync03ReadApi({
  verifyToken:verifier,
  loadActor:async sub=>actors[sub]||null,
  loadTripSnapshot:async (_actor,id)=>id===ST?{...baseCtx,...overrides}:null
 }));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const req=async(path,subject,opts={})=>{
  const headers={...opts.headers};
  if(subject)headers.authorization='Bearer '+token(subject,opts.expires);
  const r=await fetch(origin+path,{method:opts.method||'GET',headers,signal:AbortSignal.timeout(4000)});
  return {status:r.status,json:await r.json(),cache:r.headers.get('cache-control')};
 };
 try {await fn(req);}finally{await new Promise(r=>server.close(r));}
}
test('JWT directly verifies signed fixture and seeded actor',()=>{
  assert.deepEqual(verifier(token('parent')),{subject:'parent'});
  assert.match(actors.parent.userId,/^[0-9a-f-]{36}$/);
});
test('JWT signed RS256 authenticates /me; fake headers do not elevate role',async()=>{
 await serve(async req=>{
  const x=await req('/api/v3/sync/me','parent',{headers:{'x-role':'school_admin','x-user-id':X}});
  assert.equal(x.status,200);
  assert.equal(x.json.userId,P);
  assert.deepEqual(x.json.memberships,[{organizationId:S,role:'parent'}]);
  assert.equal(x.cache,'no-store');
 });
});
test('unauthenticated, fake bearer, expired token, unknown subject denied',async()=>{
 await serve(async req=>{
  assert.equal((await req('/api/v3/sync/me')).status,401);
  assert.equal((await req('/api/v3/sync/me','badParent',{expires:now-2})).status,401);
  assert.equal((await req('/api/v3/sync/me','not-present')).status,401);
  assert.equal((await req('/api/v3/sync/me',null,{headers:{authorization:'Bearer forged'}})).status,401);
 });
});
test('parent sees only own opaque student ID and events, no stops or classmates',async()=>{
 await serve(async req=>{
  const result=await req('/api/v3/sync/trips/'+ST+'/snapshot','parent');
  assert.equal(result.status,200);
  assert.equal(result.json.scope,'parent');
  assert.deepEqual(result.json.students,[{studentId:A,status:'aboard'}]);
  assert.deepEqual(result.json.events.map(e=>e.studentId),[A]);
  const json=JSON.stringify(result.json);
  assert.doesNotMatch(json,/NAME-PRIVATE|OTHER-PRIVATE|SECRET|latitude|actorUserId/);
  assert.ok(!json.includes(B));
  assert.equal(result.json.routeStops,undefined);
 });
});
test('parent from other school denied even if student ID spoofed',async()=>{
 await serve(async req=>{
  assert.equal((await req('/api/v3/sync/trips/'+ST+'/snapshot','badParent')).status,404);
 });
});
test('driver assigned to trip sees only assigned opaque references and route stops',async()=>{
 await serve(async req=>{
  const {status,json}=await req('/api/v3/sync/trips/'+ST+'/snapshot','driver');
  assert.equal(status,200);assert.equal(json.scope,'driver');
  assert.deepEqual(json.students.map(x=>x.studentId),[A,B]);
  assert.deepEqual(json.routeStops,[{id:C,sequence:1,label:'École',reached:true}]);
  assert.equal('driverUserId' in json.trip,false);
 });
});
test('assigned attendant may view, other operator attendant may not',async()=>{
 await serve(async req=>{
  assert.equal((await req('/api/v3/sync/trips/'+ST+'/snapshot','attendant')).status,200);
  assert.equal((await req('/api/v3/sync/trips/'+ST+'/snapshot','otherAttendant')).status,404);
  assert.equal((await req('/api/v3/sync/trips/'+ST+'/snapshot','disabledAttendant')).status,404);
 });
});
test('revoked attendant assignment denies snapshot',async()=>{
 await serve(async req=>{
  const ctx={attendantAssignments:[{userId:H,tripId:ST,active:false,revokedAt:'2026-10-21'}]};
  assert.equal((await req('/api/v3/sync/trips/'+ST+'/snapshot','attendant')).status,404);
 },{attendantAssignments:[{userId:H,tripId:ST,active:false,revokedAt:'2026-10-21'}]});
});
test('unassigned trip and malformed UUID are uniformly refused',async()=>{
 await serve(async req=>{
  assert.equal((await req('/api/v3/sync/trips/'+AA+'/snapshot','driver')).status,404);
  assert.equal((await req('/api/v3/sync/trips/not-uuid/snapshot','driver')).status,400);
 });
});
test('POST write endpoint remains disabled: no pointage API is activated',async()=>{
 await serve(async req=>{
  assert.equal((await req('/api/v3/sync/trips/'+ST+'/snapshot','attendant',{method:'POST'})).status,405);
  assert.equal((await req('/api/v3/sync/trips/'+ST+'/events','attendant',{method:'POST'})).status,404);
 });
});
test('unexpected query, unknown paths, sensitive values and server exceptions',async()=>{
 await serve(async req=>{
  assert.equal((await req('/api/v3/sync/me?userId='+X,'admin')).status,400);
  assert.equal((await req('/api/v3/sync/admin','admin')).status,404);
 });
 const server=http.createServer(createSync03ReadApi({verifyToken:verifier,loadActor:async()=>{throw Error('SQL_SECRET');},loadTripSnapshot:async()=>null}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v3/sync/me',
    {headers:{authorization:'Bearer '+token('parent')}});
  assert.equal(response.status,500);
  assert.deepEqual(await response.json(),{error:'INTERNAL_ERROR'});
 } finally {await new Promise(r=>server.close(r));}
});
