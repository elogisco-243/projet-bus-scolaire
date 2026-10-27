import test from 'node:test';
import assert from 'node:assert/strict';
import {driverAdvancedDecision,driverOperationalDecision} from '../mobile-session19/driver-advanced-rules.mjs';
const baseline=()=>({
 mode:'demo',role:'driver',session:{mode:'demo',role:'driver'},
 trip:{id:'TRIP-DEMO',status:'planned'},
 parked:true,ready:true,atStop:false,activeStopId:null,
 crew:{mode:'paired',attendantPresent:true},alerts:[],students:[],
 stops:[{id:'S1',reached:false},{id:'S2',reached:false}]
});
test('UI182: departure requires proper crew and secure vehicle',()=>{
 const s=baseline();assert.equal(driverAdvancedDecision(s,'begin').ok,true);
 s.crew.attendantPresent=false;assert.equal(driverAdvancedDecision(s,'begin').code,'ATTENDANT_NOT_PRESENT');
 s.crew={mode:'solo',soloAuthorized:true,attendantMandatory:true};
 assert.equal(driverAdvancedDecision(s,'begin').code,'SOLO_NOT_AUTHORIZED');
 s.crew={mode:'replacement',replacementAuthorized:false};
 assert.equal(driverAdvancedDecision(s,'begin').code,'REPLACEMENT_NOT_AUTHORIZED');
 s.crew={mode:'paired',attendantPresent:true};s.parked=false;
 assert.equal(driverAdvancedDecision(s,'begin').code,'DEPARTURE_NOT_SECURED');
});
test('UI182: arrival requires immobilization and clear incidents',()=>{
 const s=baseline();s.trip.status='in_progress';
 assert.equal(driverAdvancedDecision(s,'arrive').ok,true);
 s.parked=false;assert.equal(driverAdvancedDecision(s,'arrive').code,'VEHICLE_NOT_SECURED_AT_STOP');
 s.parked=true;s.alerts=[{status:'open'}];
 assert.equal(driverAdvancedDecision(s,'arrive').code,'OPEN_INCIDENTS');
});
test('UI182: boarding requires confirmed active stop and correct pupil',()=>{
 const s=baseline();s.trip.status='in_progress';s.atStop=true;s.activeStopId='S1';
 s.students=[{id:'E1',pickupStopId:'S1',dropoffStopId:'S2',boarded:false,alighted:false,absent:false}];
 assert.equal(driverAdvancedDecision(s,'board',{studentId:'E1'}).code,'STOP_NOT_CONFIRMED');
 s.stops[0].reached=true;
 assert.equal(driverAdvancedDecision(s,'board',{studentId:'E1'}).ok,true);
 assert.equal(driverAdvancedDecision(s,'board',{studentId:'bad'}).code,'STUDENT_OR_ACTION_UNKNOWN');
});
test('UI182: closure checks reconciliation, open alerts and explicit inspection',()=>{
 const s=baseline();s.trip.status='in_progress';s.atStop=true;s.activeStopId='S2';
 s.stops.forEach(p=>p.reached=true);
 assert.equal(driverAdvancedDecision(s,'close-trip').code,'FINAL_INSPECTION_REQUIRED');
 assert.equal(driverAdvancedDecision(s,'close-trip',{inspectionConfirmed:true}).ok,true);
 s.students=[{id:'E1',boarded:true,alighted:false,absent:false}];
 assert.equal(driverAdvancedDecision(s,'close-trip',{inspectionConfirmed:true}).code,'CHILDREN_REMAIN');
});
test('UI182: no new trip before closure, no local cross-role approval',()=>{
 const s=baseline();
 assert.equal(driverAdvancedDecision(s,'new-trip').code,'PREVIOUS_TRIP_NOT_CLOSED');
 s.trip.status='closed';assert.equal(driverAdvancedDecision(s,'new-trip').ok,true);
 assert.equal(driverAdvancedDecision(s,'cross-role-approval').code,'TRUSTED_SERVER_VERIFICATION_REQUIRED');
});
test('UI182: operational dispatch and self-asserted actors fail closed',()=>{
 const s=baseline();s.session.role='attendant';
 assert.equal(driverAdvancedDecision(s,'begin').code,'DRIVER_DEMO_CONTEXT_REQUIRED');
 assert.equal(driverOperationalDecision().code,'OPERATIONAL_DISPATCH_DISABLED');
});
