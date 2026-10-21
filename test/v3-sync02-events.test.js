'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseOfflineStudentEvent, evaluateStudentPointage, materializeAuthorizedEvent, checkIdempotency } = require('../src/v3/sync02-events');
const ids = {
  trip:'11111111-1111-4111-8111-111111111111', child:'22222222-2222-4222-8222-222222222222',
  stop:'33333333-3333-4333-8333-333333333333', event:'44444444-4444-4444-8444-444444444444',
  driver:'55555555-5555-4555-8555-555555555555',attendant:'66666666-6666-4666-8666-666666666666',
  outsider:'77777777-7777-4777-8777-777777777777',operator:'88888888-8888-4888-8888-888888888888'
};
const at='2026-10-21T12:00:00.000Z', now=Date.parse(at);
const raw={id:ids.event, tripId:ids.trip, studentId:ids.child, stopId:ids.stop,type:'board',occurredAt:at};
const normalized=parseOfflineStudentEvent(raw,now).event;
const member=(organizationId,role,active=true)=>({organizationId,role,active});
const driver={userId:ids.driver,memberships:[member(ids.operator,'driver')]};
const attendant={userId:ids.attendant,memberships:[member(ids.operator,'attendant')]};
const context={trip:{id:ids.trip, operatorId:ids.operator, driverUserId:ids.driver,status:'in_progress'},
  tripStudentIds:[ids.child],routeStopIds:[ids.stop],currentStopId:ids.stop,
  parkedConfirmed:true,attendantAssignments:[{tripId:ids.trip,userId:ids.attendant,active:true,revokedAt:null}],
  soloAuthorization:null};
test('parse queue event; discard all client privilege fields',()=>{
  const parsed=parseOfflineStudentEvent({...raw,actorUserId:ids.driver,role:'admin',parkedConfirmed:true,authorized:true,secret:'x'},now);
  assert.equal(parsed.ok,true);
  assert.deepEqual(Object.keys(parsed.event).sort(),['id','occurredAt','stopId','studentId','tripId','type'].sort());
});
test('reject malformed identifiers, timestamps and unrelated event types',()=>{
  assert.equal(parseOfflineStudentEvent({...raw,id:'A-01'},now).ok,false);
  assert.equal(parseOfflineStudentEvent({...raw,type:'stop_arrival'},now).ok,false);
  assert.equal(parseOfflineStudentEvent({...raw,occurredAt:'n/a'},now).ok,false);
  assert.equal(parseOfflineStudentEvent({...raw,occurredAt:'2026-10-22T12:00:00.000Z'},now).ok,false);
  assert.equal(parseOfflineStudentEvent({...raw,occurredAt:'2026-10-01T12:00:00.000Z'},now).ok,false);
});
test('assigned, active attendant can pointage at the verified stop',()=>{
  const result=evaluateStudentPointage(attendant,context,normalized);
  assert.deepEqual(result,{ok:true, actorUserId:ids.attendant,stopId:ids.stop,pointageMode:'attendant'});
});
test('attendant not assigned / revoked / inactive membership cannot pointage',()=>{
  const noRole={...attendant,memberships:[member(ids.operator,'attendant',false)]};
  assert.equal(evaluateStudentPointage(noRole,context,normalized).ok,false);
  assert.equal(evaluateStudentPointage(attendant,{...context,attendantAssignments:[]},normalized).ok,false);
  assert.equal(evaluateStudentPointage(attendant,{...context,attendantAssignments:[{...context.attendantAssignments[0],revokedAt:at}]},normalized).ok,false);
});
test('driver with accompanist present cannot pointage (even if solo approved)',()=>{
  assert.equal(evaluateStudentPointage(driver,{...context,soloAuthorization:{approved:true,tripId:ids.trip,driverUserId:ids.driver}},normalized).ok,false);
});
test('exceptional driver can pointage only after server-approved solo authorization',()=>{
  const solo={...context,attendantAssignments:[],soloAuthorization:{approved:true,tripId:ids.trip,driverUserId:ids.driver,revokedAt:null}};
  assert.equal(evaluateStudentPointage(driver,solo,normalized).ok,true);
  assert.equal(evaluateStudentPointage(driver,{...solo,soloAuthorization:{...solo.soloAuthorization,revokedAt:at}},normalized).ok,false);
  assert.equal(evaluateStudentPointage(driver,{...solo,soloAuthorization:null},normalized).ok,false);
});
test('reject unparked, unknown stop, different stop, wrong student and closed trip',()=>{
  assert.equal(evaluateStudentPointage(attendant,{...context,parkedConfirmed:false},normalized).ok,false);
  assert.equal(evaluateStudentPointage(attendant,{...context,routeStopIds:[]},normalized).ok,false);
  assert.equal(evaluateStudentPointage(attendant,{...context,currentStopId:ids.trip},normalized).ok,false);
  assert.equal(evaluateStudentPointage(attendant,{...context,tripStudentIds:[]},normalized).ok,false);
  assert.equal(evaluateStudentPointage(attendant,{...context,trip:{...context.trip,status:'completed'}},normalized).ok,false);
});
test('parent, unrelated school member, and wrong-operator attendant denied',()=>{
  const parent={userId:ids.outsider,memberships:[member(ids.operator,'parent')]};
  const wrong={...attendant,memberships:[member(ids.trip,'attendant')]};
  assert.equal(evaluateStudentPointage(parent,context,normalized).ok,false);
  assert.equal(evaluateStudentPointage(wrong,context,normalized).ok,false);
});
test('event ID replay is confirmed only for identical actor/payload',()=>{
  const stored={...normalized,actorUserId:ids.attendant};
  assert.deepEqual(checkIdempotency(null,normalized,ids.attendant),{ok:true,result:'recorded'});
  assert.deepEqual(checkIdempotency(stored,normalized,ids.attendant),{ok:true,result:'already_recorded'});
  assert.equal(checkIdempotency(stored,{...normalized,studentId:ids.trip},ids.attendant).reason,'IDEMPOTENCY_CONFLICT');
  assert.equal(checkIdempotency(stored,normalized,ids.driver).reason,'IDEMPOTENCY_CONFLICT');
});

test('offline event without stop ID is canonicalized using server-authorized stop',()=>{
  const parsed=parseOfflineStudentEvent({...raw,stopId:null},now);
  assert.equal(parsed.ok,true);
  const d=evaluateStudentPointage(attendant,context,parsed.event);
  assert.equal(d.ok,true);
  const materialized=materializeAuthorizedEvent(parsed.event,d);
  assert.equal(materialized.record.stopId,ids.stop);
  assert.equal(materialized.record.actorUserId,ids.attendant);
  assert.deepEqual(checkIdempotency({...materialized.record}, materialized.record,ids.attendant),
    {ok:true,result:'already_recorded'});
});
