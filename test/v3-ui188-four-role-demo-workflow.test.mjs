import test from 'node:test';
import assert from 'node:assert/strict';
import {createFourRoleDemo,executeFourRoleDemo,fourRoleDemoView,fourRoleOperationalDispatch} from '../mobile-session19/four-role-demo-workflow.mjs';
function go(s,role,action,rest={}){const x=executeFourRoleDemo(s,{role,action,...rest});assert.equal(x.ok,true,action+': '+x.code);return x.snapshot;}
test('one shared Golf route and one bus for all profiles',()=>{
 const s=createFourRoleDemo();
 for(const role of ['driver','attendant','parent','supervisor']){
  const v=fourRoleDemoView(s,role);
  assert.equal(v.busId,'LUB-014');assert.equal(v.stopsTotal,4);
 }
});
test('driver may not start without attendant and safety readiness',()=>{
 let s=createFourRoleDemo();
 assert.equal(executeFourRoleDemo(s,{role:'driver',action:'start_trip'}).code,'DEPARTURE_NOT_READY');
 s=go(s,'attendant','check_in');s=go(s,'driver','secure_vehicle');
 s=go(s,'attendant','ready_departure');s=go(s,'driver','start_trip');
 assert.equal(s.status,'in_progress');
});
test('attendant pointage and no departure until pending pupils cleared',()=>{
 let s=createFourRoleDemo();
 s=go(s,'attendant','check_in');s=go(s,'driver','secure_vehicle');
 s=go(s,'attendant','ready_departure');s=go(s,'driver','start_trip');
 s=go(s,'driver','secure_vehicle');s=go(s,'driver','arrive_stop');
 assert.equal(executeFourRoleDemo(s,{role:'driver',action:'resume_trip'}).code,'POINTAGE_PENDING');
 s=go(s,'attendant','board',{studentId:'A-01'});
 assert.equal(executeFourRoleDemo(s,{role:'attendant',action:'board',studentId:'A-01'}).code,'DUPLICATE_OR_ABSENT');
 s=go(s,'driver','resume_trip');
 s=go(s,'driver','secure_vehicle');s=go(s,'driver','arrive_stop');
 s=go(s,'attendant','board',{studentId:'A-02'});
 s=go(s,'attendant','mark_absent',{studentId:'A-03',reason:'non_present'});
 s=go(s,'driver','resume_trip');
 s=go(s,'driver','secure_vehicle');s=go(s,'driver','arrive_stop');
 s=go(s,'attendant','board',{studentId:'A-04'});
 s=go(s,'driver','resume_trip');
 s=go(s,'driver','secure_vehicle');s=go(s,'driver','arrive_stop');
 assert.equal(executeFourRoleDemo(s,{role:'driver',action:'finish_trip'}).code,'FINAL_INSPECTION_REQUIRED');
 for(const id of ['A-01','A-02','A-04'])s=go(s,'attendant','alight',{studentId:id});
 s=go(s,'attendant','confirm_empty');
 s=go(s,'driver','finish_trip');
 s=go(s,'supervisor','review_trip');
 assert.equal(s.tripReviewed,true);
});
test('parent only sees explicitly scoped students; cannot command bus',()=>{
 let s=createFourRoleDemo();
 assert.equal(executeFourRoleDemo(s,{role:'parent',action:'start_trip'}).code,'ROLE_ACTION_FORBIDDEN');
 assert.deepEqual(fourRoleDemoView(s,'parent').students,[]);
 assert.deepEqual(fourRoleDemoView(s,'parent',{parentStudentIds:['A-01']}).students.map(p=>p.id),['A-01']);
});
test('critical incident blocks movement and requires supervisor closure',()=>{
 let s=createFourRoleDemo();
 s=go(s,'attendant','check_in');s=go(s,'driver','secure_vehicle');s=go(s,'attendant','ready_departure');
 s=go(s,'driver','start_trip');
 s=go(s,'driver','report_incident',{kind:'breakdown'});
 assert.equal(executeFourRoleDemo(s,{role:'driver',action:'arrive_stop'}).code,'VEHICLE_NOT_SECURED');
 s=go(s,'driver','secure_vehicle');
 assert.equal(executeFourRoleDemo(s,{role:'driver',action:'arrive_stop'}).code,'OPEN_INCIDENTS');
 s=go(s,'supervisor','resolve_incident',{incidentId:s.incidents[0].id});
 s=go(s,'driver','arrive_stop');assert.equal(s.stops[0].reached,true);
});
test('operational disabled, invalid role rejected, input is never mutated',()=>{
 const s=createFourRoleDemo();const before=JSON.stringify(s);
 assert.equal(fourRoleOperationalDispatch().code,'OPERATIONAL_DISPATCH_DISABLED');
 assert.equal(executeFourRoleDemo(s,{role:'parent',action:'board',studentId:'A-01'}).code,'ROLE_ACTION_FORBIDDEN');
 assert.equal(executeFourRoleDemo(s,{role:'unknown',action:'start_trip'}).code,'ROLE_UNKNOWN');
 go(s,'attendant','check_in');assert.equal(JSON.stringify(s),before);
});
