import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planCompleteInterfaceAction as plan,operationalDispatch} from '../mobile-session22/full-interface-adapter.mjs';
const a=(action,extra={})=>plan({profile:'accompagnateur',action,mode:'demo',tripId:'TRIP-DEMO',...extra});
test('UI177/01: full Attendant UI-170 action names remain available in source and adapter',()=>{
 const src=readFileSync(new URL('../mobile-session19/app.mjs',import.meta.url),'utf8');
 for(const action of ['demo_prepare_departure','start_demo_trip','simulate_arrival','board',
  'mark_absent','demo_confirm_empty_and_finish','simulate_driver_resume'])
  assert.ok(src.includes(action),action);
 assert.equal(a('demo_prepare_departure').action,'trip.ready');
});
test('UI177/02: attendant pointage maps to distinct student action, without dispatch',()=>{
 const r=a('board',{studentId:'E-01'});
 assert.equal(r.ok,true);assert.equal(r.action,'student.board');assert.equal(r.dispatchEnabled,false);
 assert.equal(a('board').code,'STUDENT_CONTEXT_REQUIRED');
});
test('UI177/03: synthetic driver controls cannot impersonate real driver approval',()=>{
 for(const action of ['start_demo_trip','simulate_arrival','simulate_driver_resume','demo_confirm_empty_and_finish'])
  assert.equal(a(action).code,'CROSS_ROLE_APPROVAL_REQUIRED',action);
});
test('UI177/04: driver operations can be classified without submitting',()=>{
 const r=plan({profile:'chauffeur',action:'arrive',tripId:'TRIP-DEMO'});
 assert.equal(r.action,'trip.arrive');assert.equal(r.dispatchEnabled,false);
});
test('UI177/05: handover requires separate review',()=>{
 assert.equal(a('alight').requiresIndependentReview,true);
});
test('UI177/06: unknown role, mode and action fail closed',()=>{
 assert.equal(plan({profile:'parent',action:'start'}).ok,false);
 assert.equal(plan({profile:'chauffeur',action:'start',mode:'operational'}).ok,false);
 assert.equal(a('unknown').ok,false);
 assert.equal(operationalDispatch().ok,false);
});
test.todo('UI177/REAL: bind classified commands to signed authenticated server sessions, without changing full UI');
test.todo('UI177/REAL: demonstrate real-driver/attendant cross-confirmation using two Android APK sessions');
test.todo('UI177/REAL: build and validate complete Parent/Supervisor Android interfaces');
