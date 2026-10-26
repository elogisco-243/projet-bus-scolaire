import test from 'node:test';
import assert from 'node:assert/strict';
import {newCoordinationDemo,applyCoordinationDemo,viewCoordinationDemo,authorizeOperationalCommand} from '../mobile-session21/coordination-demo.mjs';
let seq=0;
const actors={driver:'DR-DEMO',attendant:'AT-DEMO',parent:'PA-DEMO',supervisor:'SU-DEMO'};
function run(s,type,role,payload={}){
 const r=applyCoordinationDemo(s,{mode:'demo',organizationId:s.organizationId,tripId:s.tripId,expectedRevision:s.revision,
  actorId:actors[role],role,type,commandId:'COMMAND-'+(++seq),payload});
 return r.state;
}
test('SYNC167/01: driver must wait for attendant readiness',()=>{
 const s=newCoordinationDemo();
 assert.throws(()=>run(s,'start','driver'),/CROSS_ROLE_READY_REQUIRED/);
 const ready=run(s,'ready','attendant');
 const started=run(ready,'start','driver');
 assert.equal(started.status,'in_progress');
 assert.equal(s.status,'planned');
});
test('SYNC167/02: sequential driver arrival and stop-clearance by attendant',()=>{
 let s=run(run(newCoordinationDemo(),'ready','attendant'),'start','driver');
 assert.throws(()=>run(s,'arrive','attendant',{stopId:'STOP-01'}),/DEMO_ROLE_DENIED/);
 assert.throws(()=>run(s,'arrive','driver',{stopId:'STOP-02'}),/STOP_ORDER_CONFLICT/);
 s=run(s,'arrive','driver',{stopId:'STOP-01'});
 assert.throws(()=>run(s,'clear_stop','attendant'),/POINTAGE_PENDING/);
 s=run(s,'board','attendant',{studentId:'E-01'});
 assert.throws(()=>run(s,'resume','driver'),/SAFETY_CLEARANCE_REQUIRED/);
 s=run(s,'clear_stop','attendant');
 s=run(s,'resume','driver');
 assert.equal(s.parked,false);
});
test('SYNC167/03: parent request waits for separate supervisor review',()=>{
 let s=run(run(newCoordinationDemo(),'ready','attendant'),'start','driver');
 s=run(s,'arrive','driver',{stopId:'STOP-01'});
 s=run(s,'request_change','parent',{studentId:'E-01',toStopId:'STOP-02',recipientId:'PA-DEMO'});
 assert.equal(s.requests[0].status,'pending');
 assert.equal(s.students[0].dropoffStopId,'STOP-03');
 assert.throws(()=>run(s,'review_change_demo','parent',{requestId:s.requests[0].id,demoPolicyApproved:true}),/DEMO_ROLE_DENIED/);
 s=run(s,'review_change_demo','supervisor',{requestId:s.requests[0].id,demoPolicyApproved:true});
 assert.equal(s.requests[0].status,'approved_demo');
 assert.equal(s.students[0].dropoffStopId,'STOP-02');
});
test('SYNC167/04: operational authorization remains unavailable',()=>{
 const s=newCoordinationDemo();
 assert.equal(authorizeOperationalCommand().ok,false);
 assert.throws(()=>applyCoordinationDemo(s,{mode:'operational',type:'start',role:'driver',actorId:'DR-DEMO',
  organizationId:s.organizationId,tripId:s.tripId,expectedRevision:0,commandId:'CMD-OPER',payload:{}}),/OPERATIONAL_SERVER_REQUIRED/);
});
test('SYNC167/05: each Parent sees only their own fictitious children',()=>{
 const s=newCoordinationDemo();
 assert.deepEqual(viewCoordinationDemo(s,'PA-DEMO').children.map(p=>p.studentId),['E-01']);
 assert.deepEqual(viewCoordinationDemo(s,'PB-DEMO').children.map(p=>p.studentId),['E-02']);
});
test('SYNC167/06: idempotent delivery and stale revisions',()=>{
 let s=run(run(newCoordinationDemo(),'ready','attendant'),'start','driver');
 const c={mode:'demo',organizationId:s.organizationId,tripId:s.tripId,expectedRevision:s.revision,
  actorId:'DR-DEMO',role:'driver',type:'arrive',commandId:'COMMAND-RETRY-01',payload:{stopId:'STOP-01'}};
 let a=applyCoordinationDemo(s,c),b=applyCoordinationDemo(a.state,c);
 assert.equal(a.accepted,true);
 assert.equal(b.accepted,false);
 assert.equal(a.state.revision,b.state.revision);
 assert.throws(()=>applyCoordinationDemo(a.state,{...c,payload:{stopId:'STOP-02'}}),/IDEMPOTENCY_CONFLICT/);
 assert.throws(()=>applyCoordinationDemo(a.state,{...c,commandId:'COMMAND-STALE',payload:{stopId:'STOP-02'}}),/STALE_REVISION/);
});
test('SYNC167/07: a critical incident blocks normal departure',()=>{
 let s=run(run(newCoordinationDemo(),'ready','attendant'),'start','driver');
 s=run(s,'arrive','driver',{stopId:'STOP-01'});
 s=run(s,'board','attendant',{studentId:'E-01'});
 s=run(s,'report_critical','driver',{kind:'missing_child'});
 assert.throws(()=>run(s,'clear_stop','attendant'),/CRITICAL_INCIDENT_OPEN/);
 assert.throws(()=>run(s,'resolve_critical_demo','attendant',{incidentId:s.alerts[0].id,demoResolutionConfirmed:true}),/DEMO_ROLE_DENIED/);
 s=run(s,'resolve_critical_demo','supervisor',{incidentId:s.alerts[0].id,demoResolutionConfirmed:true});
 assert.equal(run(s,'clear_stop','attendant').stopClearance,true);
});
test('SYNC167/08: synthetic handover requires separate reviewed identity and physically recorded delivery',()=>{
 let s=run(run(newCoordinationDemo(),'ready','attendant'),'start','driver');
 s=run(s,'arrive','driver',{stopId:'STOP-01'});
 s=run(s,'board','attendant',{studentId:'E-01'});
 s=run(s,'clear_stop','attendant');
 s=run(s,'resume','driver');
 s=run(s,'arrive','driver',{stopId:'STOP-02'});
 s=run(s,'absent','attendant',{studentId:'E-02',reason:'family_notified'});
 s=run(s,'clear_stop','attendant');
 s=run(s,'resume','driver');
 s=run(s,'arrive','driver',{stopId:'STOP-03'});
 assert.throws(()=>run(s,'handover_demo','attendant',{studentId:'E-01',recipientId:'PA-DEMO',badgeVerified:true}),/SYNTHETIC_HANDOVER_REVIEW_REQUIRED/);
 s=run(s,'review_handover_demo','supervisor',{studentId:'E-01',recipientId:'PA-DEMO',demoRecipientAndPersonChecked:true});
 assert.throws(()=>run(s,'handover_demo','attendant',{studentId:'E-01',recipientId:'PA-DEMO'}),/SYNTHETIC_HANDOVER_REVIEW_REQUIRED/);
 s=run(s,'handover_demo','attendant',{studentId:'E-01',recipientId:'PA-DEMO',demoPhysicalHandoverConfirmed:true});
 assert.equal(s.students[0].released,true);
 assert.throws(()=>run(s,'finish','driver',{demoInspectionAcknowledged:true}),/CLOSURE_NOT_SAFE/);
 s=run(s,'clear_stop','attendant');
 s=run(s,'finish','driver',{demoInspectionAcknowledged:true});
 assert.equal(s.status,'completed');
});
test.todo('SYNC167: actual trusted backend with identity, badge and offline conflict resolution still required');
