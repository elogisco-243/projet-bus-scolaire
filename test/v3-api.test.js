'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createV3Api}=require('../src/v3/api');
const {createV3Repository}=require('../src/v3/repository');

const ID_A='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ID_B='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const baseTrip={id:ID_A,schoolId:'school-A',operatorId:'operator-A',driverUserId:'driver-A',
  status:'in_progress',routeCode:'A01',scheduledStartAt:'2026-10-14T06:00:00Z'};
const otherTrip={...baseTrip,id:ID_B,schoolId:'school-B',operatorId:'operator-B',driverUserId:'driver-B',routeCode:'B01'};
const contexts=[{trip:baseTrip,tripStudentIds:['child-A']},{trip:otherTrip,tripStudentIds:['child-B']}];
const m=(organizationId,role)=>({organizationId,role,active:true});
const actors={
  'parent-A':{userId:'parent-A',memberships:[m('school-A','parent')],verifiedStudentIds:['child-A']},
  'parent-B':{userId:'parent-B',memberships:[m('school-B','parent')],verifiedStudentIds:['child-B']},
  'school-A':{userId:'school-admin-A',memberships:[m('school-A','school_admin')],verifiedStudentIds:[]},
  'dispatcher-A':{userId:'dispatcher-A',memberships:[m('operator-A','dispatcher')],verifiedStudentIds:[]}
};
function fakeRepository(){return {
  loadActor:async sub=>actors[sub]??null,
  getTripContext:async id=>contexts.find(c=>c.trip.id===id)??null,
  // Volontairement trop de ressources : l'API doit re-controler leur portee.
  listTripContexts:async ()=>contexts,
  listVehicles:async ()=>[
    {id:'bus-A',operatorId:'operator-A',fleetCode:'A1',seatCapacity:15,active:true},
    {id:'bus-B',operatorId:'operator-B',fleetCode:'B1',seatCapacity:30,active:true}
  ]
};}
async function withServer(fn){
  const server=http.createServer(createV3Api({
    verifyToken:t=>{if(t.startsWith('valid-'))return {subject:t.slice(6)};throw Error('bad token');},
    repository:fakeRepository()
  }));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const request=async (path,subject,opts={})=>{
    const res=await fetch(origin+path,{
      method:opts.method||'GET',headers:subject?{authorization:`Bearer valid-${subject}`}:{},signal:AbortSignal.timeout(3000)
    });return {status:res.status,headers:res.headers,json:await res.json()};
  };
  try{await fn(request);}finally{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
}
test('API refuse les appels anonymes, jetons faux et identites non enregistrees', async()=>{
  await withServer(async request=>{
    assert.equal((await request('/api/v3/me')).status,401);
    assert.equal((await request('/api/v3/me','ghost')).status,401);
    assert.equal((await request('/api/v3/me','parent-A')).status,200);
    assert.equal((await request('/api/v3/me','parent-A',{method:'POST'})).status,405);
  });
});
test('API /me ne renvoie aucune reference eleve ni jeton', async()=>{
  await withServer(async request=>{
    const result=await request('/api/v3/me','parent-A');
    assert.deepEqual(result.json,{userId:'parent-A',memberships:[{role:'parent',organizationId:'school-A'}]});
    assert.equal(result.headers.get('cache-control'),'no-store');
  });
});
test('un parent ne peut voir le trajet ou la flotte d un autre tenant',async()=>{
  await withServer(async request=>{
    const own=await request('/api/v3/trips/'+ID_A,'parent-A');
    assert.equal(own.status,200);assert.equal(own.json.trip.id,ID_A);
    assert.equal('driverUserId' in own.json.trip,false);
    assert.equal((await request('/api/v3/trips/'+ID_B,'parent-A')).status,404);
    const list=await request('/api/v3/trips','parent-A');
    assert.deepEqual(list.json.items.map(x=>x.id),[ID_A]);
    assert.equal((await request('/api/v3/vehicles','parent-A')).status,403);
  });
});
test('ecole et transporteur limites aux ressources du perimetre',async()=>{
  await withServer(async request=>{
    assert.equal((await request('/api/v3/trips/'+ID_B,'school-A')).status,404);
    const fleet=await request('/api/v3/vehicles','dispatcher-A');
    assert.deepEqual(fleet.json.items.map(v=>v.id),['bus-A']);
    const trips=await request('/api/v3/trips','dispatcher-A');
    assert.deepEqual(trips.json.items.map(t=>t.id),[ID_A]);
  });
});
test('pagination strictement bornee et identifiants de trajets controles',async()=>{
  await withServer(async request=>{
    for(const path of ['/api/v3/trips?limit=999','/api/v3/trips?offset=-1',
      '/api/v3/trips?offset=99999','/api/v3/trips?limit=1.5'])
      assert.equal((await request(path,'school-A')).status,400);
    assert.equal((await request('/api/v3/trips/not-a-uuid','school-A')).status,400);
  });
});
test('requete SQL parametree par identite et perimetre actif',async()=>{
  const calls=[];
  const fakeDb={query:async(sql,params)=>{
    calls.push({sql,params});
    if(sql.includes('FROM users WHERE')) return {rows:[{id:ID_A}]};
    if(sql.includes('SELECT m.organization_id')) return {rows:[{organizationId:ID_B,role:'parent',active:true}]};
    return {rows:[]};
  }};
  const repo=createV3Repository(fakeDb);
  const actor=await repo.loadActor('issuer|subject-value');
  assert.equal(actor.userId,ID_A);
  await repo.listTripContexts(actor,10,0);
  await repo.listVehicles(actor,10,0);
  assert.deepEqual(calls[0].params,['issuer|subject-value']);
  assert.ok(calls[0].sql.includes('identity_subject=$1'));
  const tripSql=calls.find(x=>x.sql.includes('FROM trips t JOIN routes'));
  assert.deepEqual(tripSql.params,[ID_A,11,0]);
  assert.ok(tripSql.sql.includes('l.revoked_at IS NULL'));
  assert.ok(tripSql.sql.includes('m.active=true'));
  assert.ok(tripSql.sql.includes('o.active=true'));
  const fleetSql=calls.find(x=>x.sql.includes('FROM vehicles v'));
  assert.deepEqual(fleetSql.params,[ID_A,11,0]);
});
