import test from 'node:test';
import assert from 'node:assert/strict';
import {createSync05Transport,canonicalPointage,Sync05Error}
  from '../transport.mjs';
import {createSync05QueueRunner} from '../queue.mjs';
const T='44444444-4444-4444-8444-444444444444';
const A='66666666-6666-4666-8666-666666666666';
const B='77777777-7777-4777-8777-777777777777';
const STOP='88888888-8888-4888-8888-888888888888';
const ID='10000000-0000-4000-8000-000000000001';
const ID2='10000000-0000-4000-8000-000000000002';
const time='2026-10-22T08:00:00.000Z';
const event=(id=ID,studentId=A,type='board')=>({
 id,tripId:T,studentId,stopId:STOP,type,occurredAt:time,
 status:'pending',attempts:0,detail:'never send notes',role:'operator_admin'
});
function fakeServer(){
 const ledger=new Map();let online=true,loseAckOnce=false,calls=0;
 const fetchImpl=async(url,opts)=>{
  calls++;
  if(!online)throw Error('connection dropped');
  const user=opts.headers.authorization.slice(7);
  if(!['crew','parent'].includes(user))return Response.json({error:'UNAUTHORIZED'},{status:401});
  if(opts.method==='POST'){
   if(user!=='crew')return Response.json({error:'NOT_AUTHORIZED'},{status:403});
   const x=JSON.parse(opts.body);
   if(x.studentId!==A&&x.studentId!==B)
     return Response.json({error:'WRONG_STUDENT'},{status:403});
   if(x.tripId!==T||x.stopId!==STOP)
     return Response.json({error:'STOP_NOT_ATTESTED'},{status:409});
   const found=ledger.get(x.id);
   const equal=found&&JSON.stringify(found.event)===JSON.stringify(x);
   if(found&&!equal)return Response.json({error:'EVENT_CONFLICT'},{status:409});
   if(!found)ledger.set(x.id,{event:x,actor:user,seq:1});
   if(loseAckOnce){loseAckOnce=false;throw Error('ACK lost after server committed');}
   return Response.json({eventId:x.id,result:found?'already_recorded':'recorded',sequenceNo:1},
     {status:found?200:201});
  }
  if(opts.method==='GET'&&url.endsWith('/api/v3/sync/trips/'+T+'/snapshot')){
   const ids=user==='parent'?[A]:[A,B];
   return Response.json({
     trip:{id:T,status:'in_progress'},scope:user==='parent'?'parent':'attendant',
     students:ids.map(studentId=>({studentId,status:[...ledger.values()].some(x=>x.event.studentId===studentId)?'aboard':'assigned'})),
     events:[...ledger.values()].filter(x=>ids.includes(x.event.studentId))
       .map(x=>({eventId:x.event.id,studentId:x.event.studentId,action:x.event.type}))
   },{status:200});
  }
  return Response.json({error:'NOT_FOUND'},{status:404});
 };
 return {
  fetchImpl,ledger,
  setOnline:x=>{online=x;},dropNextAck:()=>{loseAckOnce=true;},
  get calls(){return calls;}
 };
}
function makeTransport(fake,user='crew'){
 return createSync05Transport({baseUrl:'https://staging.invalid/',getAccessToken:async()=>user,fetchImpl:fake.fetchImpl});
}
function makeStore(items){
 let data=structuredClone(items),writes=0;
 return {load:async()=>structuredClone(data),
 persist:async items=>{writes++;data=structuredClone(items);},
 get queue(){return structuredClone(data);},get writes(){return writes;}};
}
test('queue is disabled by default, no accidental network request',async()=>{
 const f=fakeServer(),s=makeStore([event()]);
 const runner=createSync05QueueRunner({load:s.load,persist:s.persist,transport:makeTransport(f)});
 await assert.rejects(()=>runner.run(),e=>e.code==='SYNC05_DISABLED');
 assert.equal(f.calls,0);
});
test('client only sends allowlisted event fields, not status, role or details',async()=>{
 const f=fakeServer(),c=makeTransport(f);
 const res=await c.sendPointage(event());
 assert.equal(res.result,'recorded');
 const payload=f.ledger.get(ID).event;
 assert.deepEqual(Object.keys(payload).sort(),['id','tripId','studentId','stopId','type','occurredAt'].sort());
 assert.equal('role' in payload,false);
});
test('two simulated independent devices: crew writes, parent sees own child only',async()=>{
 const f=fakeServer(),att=makeTransport(f,'crew'),parent=makeTransport(f,'parent');
 const queue1=makeStore([event(ID,A),event(ID2,B)]);
 const run=createSync05QueueRunner({load:queue1.load,persist:queue1.persist,transport:att,enabled:true});
 const result=await run.run();
 assert.equal(result.stats.confirmed,2);
 assert.equal(queue1.queue.every(x=>x.status==='synced'),true);
 const p=await parent.getSnapshot(T);
 assert.deepEqual(p.students.map(x=>x.studentId),[A]);
 assert.deepEqual(p.events.map(x=>x.studentId),[A]);
 const crew=await att.getSnapshot(T);
 assert.deepEqual(crew.students.map(x=>x.studentId),[A,B]);
 await assert.rejects(()=>parent.sendPointage(event('10000000-0000-4000-8000-000000000003',A)),
   e=>e.kind==='permanent'&&e.code==='NOT_AUTHORIZED');
});
test('network outage preserves pending event and stable UUID for retry',async()=>{
 const f=fakeServer(),s=makeStore([event()]);
 const run=createSync05QueueRunner({load:s.load,persist:s.persist,transport:makeTransport(f),enabled:true});
 f.setOnline(false);
 assert.equal((await run.run()).stats.halted,'NETWORK_UNAVAILABLE');
 assert.equal(s.queue[0].status,'pending');
 assert.equal(s.queue[0].id,ID);
 f.setOnline(true);
 assert.equal((await run.run()).stats.confirmed,1);
 assert.equal(s.queue[0].status,'synced');
 assert.equal(f.ledger.size,1);
 assert.equal(s.queue[0].attempts,2);
});
test('ACK lost after DB commit: retry is already_recorded and never duplicates',async()=>{
 const f=fakeServer(),s=makeStore([event()]);
 const run=createSync05QueueRunner({load:s.load,persist:s.persist,transport:makeTransport(f),enabled:true});
 f.dropNextAck();
 assert.equal((await run.run()).stats.halted,'NETWORK_UNAVAILABLE');
 assert.equal(f.ledger.size,1);
 assert.equal(s.queue[0].status,'pending');
 assert.equal((await run.run()).stats.confirmed,1);
 assert.equal(s.queue[0].serverResult,'already_recorded');
 assert.equal(f.ledger.size,1);
});
test('unrelated stops and alerts are not sent nor dropped',async()=>{
 const f=fakeServer();
 const stop={...event('10000000-0000-4000-8000-000000000004'),type:'stop_arrival',studentId:null};
 const s=makeStore([stop,event()]);
 const run=createSync05QueueRunner({load:s.load,persist:s.persist,transport:makeTransport(f),enabled:true});
 const r=await run.run();
 assert.equal(r.stats.skipped,1);
 assert.equal(s.queue[0].status,'pending');
 assert.equal(s.queue[1].status,'synced');
 assert.equal(f.ledger.size,1);
});
test('409 conflict requires review; NEVER acknowledges or discards pointage',async()=>{
 const f=fakeServer(),s=makeStore([event(ID,A)]);
 const c=makeTransport(f);
 await c.sendPointage(event(ID,A));
 s.persist;
 const bad=event(ID,B);
 await s.persist([bad]);
 const run=createSync05QueueRunner({load:s.load,persist:s.persist,transport:c,enabled:true});
 const r=await run.run();
 assert.equal(r.stats.halted,'NEEDS_MANUAL_REVIEW');
 assert.equal(s.queue[0].status,'pending');
});
test('non-UUID and reserved demo IDs require mapping, no request made',async()=>{
 const f=fakeServer(),c=makeTransport(f);
 await assert.rejects(()=>c.sendPointage({...event(),studentId:'A-01'}),e=>e.kind==='review');
 await assert.rejects(()=>c.sendPointage({...event(),tripId:'00000000-0000-4000-8000-000000000001'}),e=>e.kind==='review');
 assert.equal(f.calls,0);
});
test('never mark synced on invalid server acknowledgement',async()=>{
 const f=fakeServer();
 const c=createSync05Transport({baseUrl:'https://test.invalid/',getAccessToken:async()=> 'crew',
   fetchImpl:async()=>Response.json({result:'recorded',eventId:ID2,sequenceNo:1},{status:201})});
 await assert.rejects(()=>c.sendPointage(event()),e=>e.code==='INVALID_SERVER_ACK');
 assert.equal(f.calls,0);
});
test('HTTP 401 leaves queued event pending; HTTP 403 rejects with reason',async()=>{
 const fake={fetchImpl:async()=>Response.json({error:'AUTH_REQUIRED'},{status:401})};
 const auth=makeStore([event()]);
 const run=createSync05QueueRunner({load:auth.load,persist:auth.persist,transport:makeTransport(fake),enabled:true});
 assert.equal((await run.run()).stats.halted,'AUTH_REQUIRED');
 assert.equal(auth.queue[0].status,'pending');
 const f=fakeServer(),s=makeStore([event()]);
 const denied=createSync05QueueRunner({load:s.load,persist:s.persist,transport:makeTransport(f,'parent'),enabled:true});
 assert.equal((await denied.run()).stats.rejected,1);
 assert.equal(s.queue[0].reason,'NOT_AUTHORIZED');
});
test('HTTPS origin is required; never accept an arbitrary HTTP endpoint',()=>{
 assert.throws(()=>createSync05Transport({baseUrl:'http://example.com/',getAccessToken:async()=> 'x',
   fetchImpl:async()=>{}}),/HTTPS_ORIGIN/);
 assert.throws(()=>createSync05Transport({baseUrl:'https://u:p@example.com/',getAccessToken:async()=> 'x',
   fetchImpl:async()=>{}}),/HTTPS_ORIGIN/);
});
test('400/no matching events remains pending when transport is unavailable',async()=>{
 const c=createSync05Transport({baseUrl:'https://test.invalid/',getAccessToken:async()=>null,fetchImpl:async()=>{}});
 await assert.rejects(()=>c.sendPointage(event()),e=>e.code==='AUTH_REQUIRED');
});

test('lost local ACK persistence preserves pending UUID for safe replay',async()=>{
 const f=fakeServer();let state=[event()],writes=0;
 const store={
  load:async()=>structuredClone(state),
  persist:async next=>{
    writes++;
    if(next[0].status==='synced'&&writes===2)throw Error('disk full');
    state=structuredClone(next);
  }
 };
 const run=createSync05QueueRunner({
  load:store.load,persist:store.persist,transport:makeTransport(f),enabled:true
 });
 const first=await run.run();
 assert.equal(first.stats.halted,'NETWORK_UNAVAILABLE');
 assert.equal(state[0].status,'pending');
 assert.equal(f.ledger.size,1);
 const second=await run.run();
 assert.equal(second.stats.confirmed,1);
 assert.equal(state[0].status,'synced');
 assert.equal(state[0].serverResult,'already_recorded');
 assert.equal(f.ledger.size,1);
});
