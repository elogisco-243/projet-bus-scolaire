import test from 'node:test';
import assert from 'node:assert/strict';
import {
 newParentChangeDemo,parentRequestStopChange,simulateAuthorizedReview,
 cancelPendingRequest,viewAttendantDropoffs,viewParentRequest,
 simulateGuardedHandover,verifyOperationalStopChange
} from '../mobile-session20/parent-stop-change-demo.mjs';
const proposal=()=>({parentId:'P-01',studentId:'E-014',recipientId:'P-01',newStopId:'STOP-03',requestKey:'EXAMPLE-0001'});
const request=()=>parentRequestStopChange(newParentChangeDemo(),proposal());
const review=s=>simulateAuthorizedReview(s,{requestId:s.requests[0].id});
const handover=(s,x={})=>simulateGuardedHandover(s,{
 studentId:'E-014',stopId:'STOP-03',recipientId:'P-01',busParked:true,
 badgeVerified:true,physicallyIdentified:true,physicalHandoverConfirmed:true,...x
});
test('UI162/01 parent may request a downstream change but cannot silently alter roster',()=>{
 const s=request();
 assert.equal(s.requests[0].status,'pending');
 assert.equal(s.students[0].dropoffStopId,'STOP-02');
 assert.deepEqual(viewAttendantDropoffs(s,'STOP-02').map(x=>x.studentId),['E-014']);
 assert.deepEqual(viewAttendantDropoffs(s,'STOP-03'),[]);
 assert.equal(s.events[0].delivery,'LOCAL_SIMULATION_ONLY');
});
test('UI162/02 parent request approval is a distinct synthetic supervisor event',()=>{
 const pending=request(),approved=review(pending);
 assert.equal(pending.students[0].dropoffStopId,'STOP-02');
 assert.equal(approved.students[0].dropoffStopId,'STOP-03');
 assert.equal(approved.requests[0].decision,'synthetic_policy_approval_not_real');
 assert.equal(approved.trip.revision,2);
 assert.deepEqual(viewAttendantDropoffs(approved,'STOP-03').map(x=>x.studentId),['E-014']);
 assert.deepEqual(viewAttendantDropoffs(approved,'STOP-02'),[]);
});
test('UI162/03 unauthorized person cannot request an alternate stop',()=>{
 for(const id of ['G-01','X-01','MISSING']){
  assert.throws(()=>parentRequestStopChange(newParentChangeDemo(),{...proposal(),parentId:id}),/PARENT_NOT_AUTHORIZED/);
 }
});
test('UI162/04 approved recipient list and revocation are respected',()=>{
 assert.throws(()=>parentRequestStopChange(newParentChangeDemo(),{...proposal(),recipientId:'X-01'}),/RECIPIENT_NOT_AUTHORIZED/);
 const state=newParentChangeDemo();state.students[0].restrictedRecipients.push('G-01');
 assert.throws(()=>parentRequestStopChange(state,{...proposal(),recipientId:'G-01'}),/RECIPIENT_NOT_AUTHORIZED/);
});
test('UI162/05 parent cannot change to the same, passed or unknown stop',()=>{
 assert.throws(()=>parentRequestStopChange(newParentChangeDemo(),{...proposal(),newStopId:'STOP-02'}),/SAME_DROPOFF/);
 for(const id of ['STOP-01','NOPE'])assert.throws(()=>parentRequestStopChange(newParentChangeDemo(),{...proposal(),newStopId:id}),/STOP_UNAVAILABLE/);
});
test('UI162/06 passed scheduled destination prohibits last-minute silent changes',()=>{
 const state=newParentChangeDemo();state.stops[1].passed=true;
 assert.throws(()=>parentRequestStopChange(state,proposal()),/ORIGINAL_STOP_ALREADY_PASSED/);
});
test('UI162/07 duplicate request key is idempotent but conflicting payload is refused',()=>{
 const s=request(),again=parentRequestStopChange(s,proposal());
 assert.equal(again.requests.length,1);assert.equal(again.events.length,s.events.length);
 assert.throws(()=>parentRequestStopChange(s,{...proposal(),newStopId:'STOP-04'}),/IDEMPOTENCY_KEY_CONFLICT/);
});
test('UI162/08 concurrent request for same child is blocked until reviewed/cancelled',()=>{
 assert.throws(()=>parentRequestStopChange(request(),{...proposal(),requestKey:'ANOTHER-0002'}),/REQUEST_ALREADY_PENDING/);
});
test('UI162/09 request cancellation does not change current itinerary',()=>{
 const s=request();
 const cancelled=cancelPendingRequest(s,{parentId:'P-01',requestId:s.requests[0].id});
 assert.equal(cancelled.requests[0].status,'cancelled');
 assert.equal(cancelled.students[0].dropoffStopId,'STOP-02');
 assert.throws(()=>review(cancelled),/NO_PENDING_REQUEST/);
});
test('UI162/10 untrusted parent or reviewer cannot approve',()=>{
 const s=request();
 assert.throws(()=>simulateAuthorizedReview(s,{requestId:s.requests[0].id,reviewer:'P-01'}),/SUPERVISOR_REQUIRED/);
 assert.throws(()=>simulateAuthorizedReview(s,{requestId:s.requests[0].id,policyEligible:false}),/POLICY_NOT_APPROVED/);
});
test('UI162/11 previously valid authorization that is revoked blocks review',()=>{
 const s=request();s.people[0].active=false;
 assert.throws(()=>review(s),/AUTHORIZATION_CHANGED/);
});
test('UI162/12 stale concurrent trip revision and passed destination block review',()=>{
 const s=request();s.trip.revision++;
 assert.throws(()=>review(s),/STALE_TRIP_REVISION/);
 const s2=request();s2.stops[2].passed=true;
 assert.throws(()=>review(s2),/STOP_ALREADY_PASSED/);
});
test('UI162/13 changed destination still requires actual reached stop and parked bus',()=>{
 const s=review(request());
 assert.throws(()=>handover(s),/STOP_NOT_CONFIRMED/);
 s.stops[1].passed=true;s.stops[2].passed=true;
 assert.throws(()=>handover(s,{busParked:false}),/STOP_NOT_CONFIRMED/);
 assert.equal(s.students[0].alighted,false);
});
test('UI162/14 badge alone never releases an entrusted child',()=>{
 const s=review(request());s.stops[1].passed=true;s.stops[2].passed=true;
 for(const field of ['badgeVerified','physicallyIdentified','physicalHandoverConfirmed']){
  assert.throws(()=>handover(s,{[field]:false}),/HANDOVER_NOT_VERIFIED/);
  assert.equal(s.students[0].alighted,false);
 }
});
test('UI162/15 a different authorized guardian may not substitute for approved recipient',()=>{
 const s=review(request());s.stops[1].passed=true;s.stops[2].passed=true;
 assert.throws(()=>handover(s,{recipientId:'G-01'}),/RECIPIENT_OR_STOP_MISMATCH/);
});
test('UI162/16 confirmed physical handover is a separate irreversible event',()=>{
 const s=review(request());s.stops[1].passed=true;s.stops[2].passed=true;
 const out=handover(s);
 assert.equal(s.students[0].alighted,false);
 assert.equal(out.students[0].alighted,true);
 assert.equal(out.students[0].releasedTo,'P-01');
 assert.equal(out.events.at(-1).type,'synthetic_guardian_handover_confirmed');
 assert.throws(()=>handover(out),/NOT_ONBOARD/);
});
test('UI162/17 parent cannot read another request record',()=>{
 const s=request();assert.equal(viewParentRequest(s,s.requests[0].id,'P-01').status,'pending');
 assert.throws(()=>viewParentRequest(s,s.requests[0].id,'G-01'),/PARENT_NOT_AUTHORIZED/);
});
test('UI162/18 operational mode is rejected, no demo credentials are real approvals',()=>{
 const s=request();s.mode='operational';
 assert.throws(()=>simulateAuthorizedReview(s,{requestId:s.requests[0].id}),/DEMO_ONLY/);
 assert.equal(verifyOperationalStopChange({parentApproved:true,badgeVerified:true}).code,'AUTHENTICATED_SERVER_APPROVAL_REQUIRED');
});
test('UI162/19 pending request never counts as consent to release at new stop',()=>{
 const s=request();s.stops[1].passed=true;s.stops[2].passed=true;
 assert.throws(()=>handover(s),/STOP_NOT_CONFIRMED/);
});
test.todo('UI162/OPER: authenticated Parent API, case-by-case policies, cross-device acknowledgement and guardian credential verification remain unimplemented');
