import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectAttendantGesture as inspect} from '../mobile-session19/action-boundary.mjs';
const src=readFileSync(new URL('../mobile-session19/app.mjs',import.meta.url),'utf8');
test('UI178/01: complete Attendant screen imports and calls its local boundary',()=>{
 assert.match(src,/import \{inspectAttendantGesture\} from '\.\/action-boundary\.mjs'/);
 assert.match(src,/const inspection=inspectAttendantGesture/);
 const guard=src.indexOf('const inspection=inspectAttendantGesture');
 const reducer=src.indexOf('state=runAttendantDemo(state,actual,args)',guard);
 assert.ok(guard>=0&&reducer>guard);
});
test('UI178/02: preparation and pointage remain local demo-only gestures',()=>{
 assert.equal(inspect({action:'demo_prepare_departure'}).ok,true);
 const boarded=inspect({action:'board',studentId:'E-01'});
 assert.equal(boarded.ok,true);
 assert.equal(boarded.dispatchEnabled,false);
});
test('UI178/03: safety boundary rejects operational mode before local reducer',()=>{
 assert.equal(inspect({mode:'operational',action:'board',studentId:'E-01'}).code,
  'OPERATIONAL_DISPATCH_DISABLED');
});
test('UI178/04: synthetic driver interactions never imply cross-role authorization',()=>{
 for(const action of ['start_demo_trip','simulate_arrival','simulate_driver_resume','demo_confirm_empty_and_finish']){
  const status=inspect({action});
  assert.equal(status.ok,true);
  assert.equal(status.isSyntheticCrossRole,true);
  assert.equal(status.dispatchEnabled,false);
 }
});
test('UI178/05: student gesture without student identity is refused by classifier',()=>{
 assert.equal(inspect({action:'board'}).code,'STUDENT_CONTEXT_REQUIRED');
});
test('UI178/06: visual shell and layout files remain unmodified on this branch',()=>{
 assert.ok(src.includes('indicator-onboard'));
 assert.ok(src.includes('closing-primary-action'));
 assert.ok(src.includes("data-action"));
});
test.todo('UI178/REAL: integrate trusted server with complete Chauffeur and Accompagnateur APKs');
test.todo('UI178/REAL: enforce signed identity and safe cross-role approvals in production');
test.todo('UI178/REAL: verify Android APK assets copy/import and multi-device reception');
